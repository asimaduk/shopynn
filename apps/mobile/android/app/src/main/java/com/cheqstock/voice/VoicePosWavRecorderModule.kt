package com.cheqstock.voice

import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File
import java.io.FileOutputStream
import java.io.RandomAccessFile
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Records 16 kHz mono 16-bit PCM WAV for offline Whisper (whisper.rn file transcribe).
 */
class VoicePosWavRecorderModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private var audioRecord: AudioRecord? = null
    private var outputStream: FileOutputStream? = null
    private var recordThread: Thread? = null
    private val isRecording = AtomicBoolean(false)
    private var recordingPath: String? = null
    private var pcmBytesWritten: Int = 0

    override fun getName(): String = "VoicePosWavRecorder"

    @ReactMethod
    fun startRecording(filePath: String, promise: Promise) {
        if (isRecording.get()) {
            promise.reject("ALREADY_RECORDING", "Voice recorder is already running")
            return
        }

        try {
            val path = filePath.removePrefix("file://")
            val file = File(path)
            file.parentFile?.mkdirs()
            if (file.exists()) {
                file.delete()
            }

            val sampleRate = SAMPLE_RATE
            val channelConfig = AudioFormat.CHANNEL_IN_MONO
            val audioFormat = AudioFormat.ENCODING_PCM_16BIT
            val bufferSize = AudioRecord.getMinBufferSize(sampleRate, channelConfig, audioFormat)
            if (bufferSize <= 0) {
                promise.reject("INIT_FAILED", "AudioRecord buffer size unavailable")
                return
            }

            val recorder = AudioRecord(
                MediaRecorder.AudioSource.VOICE_RECOGNITION,
                sampleRate,
                channelConfig,
                audioFormat,
                bufferSize * 2,
            )
            if (recorder.state != AudioRecord.STATE_INITIALIZED) {
                recorder.release()
                promise.reject("INIT_FAILED", "AudioRecord failed to initialize")
                return
            }

            val out = FileOutputStream(file)
            writePlaceholderWavHeader(out)

            pcmBytesWritten = 0
            recordingPath = path
            audioRecord = recorder
            outputStream = out
            isRecording.set(true)

            recordThread = Thread {
                val buffer = ByteArray(bufferSize)
                try {
                    recorder.startRecording()
                    while (isRecording.get()) {
                        val read = recorder.read(buffer, 0, buffer.size)
                        if (read > 0) {
                            synchronized(out) {
                                out.write(buffer, 0, read)
                                pcmBytesWritten += read
                            }
                        } else if (read < 0) {
                            break
                        }
                    }
                } catch (_: Exception) {
                    // stop() will finalize
                }
            }.also { it.start() }

            promise.resolve(path)
        } catch (e: Exception) {
            cleanupRecorder()
            promise.reject("START_FAILED", e.message, e)
        }
    }

    @ReactMethod
    fun stopRecording(promise: Promise) {
        if (!isRecording.getAndSet(false)) {
            promise.reject("NOT_RECORDING", "Voice recorder is not running")
            return
        }

        try {
            recordThread?.join(3000)
            recordThread = null

            audioRecord?.apply {
                try {
                    stop()
                } catch (_: Exception) {
                }
                release()
            }
            audioRecord = null

            outputStream?.flush()
            outputStream?.close()
            outputStream = null

            val path = recordingPath
            if (path.isNullOrBlank()) {
                promise.reject("NO_PATH", "Recording path missing")
                return
            }

            patchWavHeader(path, pcmBytesWritten)
            recordingPath = null
            pcmBytesWritten = 0

            promise.resolve("file://$path")
        } catch (e: Exception) {
            cleanupRecorder()
            promise.reject("STOP_FAILED", e.message, e)
        }
    }

    private fun cleanupRecorder() {
        isRecording.set(false)
        try {
            recordThread?.join(1000)
        } catch (_: Exception) {
        }
        recordThread = null
        try {
            audioRecord?.release()
        } catch (_: Exception) {
        }
        audioRecord = null
        try {
            outputStream?.close()
        } catch (_: Exception) {
        }
        outputStream = null
        recordingPath = null
        pcmBytesWritten = 0
    }

    companion object {
        private const val SAMPLE_RATE = 16000
        private const val CHANNELS = 1
        private const val BITS_PER_SAMPLE = 16

        private fun writePlaceholderWavHeader(out: FileOutputStream) {
            val byteRate = SAMPLE_RATE * CHANNELS * BITS_PER_SAMPLE / 8
            val blockAlign = (CHANNELS * BITS_PER_SAMPLE / 8).toShort()
            val header = ByteArray(44)
            header[0] = 'R'.code.toByte()
            header[1] = 'I'.code.toByte()
            header[2] = 'F'.code.toByte()
            header[3] = 'F'.code.toByte()
            // chunk size @ 4 — patched on stop
            header[8] = 'W'.code.toByte()
            header[9] = 'A'.code.toByte()
            header[10] = 'V'.code.toByte()
            header[11] = 'E'.code.toByte()
            header[12] = 'f'.code.toByte()
            header[13] = 'm'.code.toByte()
            header[14] = 't'.code.toByte()
            header[15] = ' '.code.toByte()
            writeIntLE(header, 16, 16)
            writeShortLE(header, 20, 1)
            writeShortLE(header, 22, CHANNELS.toShort())
            writeIntLE(header, 24, SAMPLE_RATE)
            writeIntLE(header, 28, byteRate)
            writeShortLE(header, 32, blockAlign)
            writeShortLE(header, 34, BITS_PER_SAMPLE.toShort())
            header[36] = 'd'.code.toByte()
            header[37] = 'a'.code.toByte()
            header[38] = 't'.code.toByte()
            header[39] = 'a'.code.toByte()
            // data size @ 40 — patched on stop
            out.write(header)
        }

        private fun patchWavHeader(path: String, dataSize: Int) {
            RandomAccessFile(path, "rw").use { raf ->
                raf.seek(4)
                raf.write(intToLeBytes(36 + dataSize))
                raf.seek(40)
                raf.write(intToLeBytes(dataSize))
            }
        }

        private fun writeIntLE(buffer: ByteArray, offset: Int, value: Int) {
            buffer[offset] = (value and 0xff).toByte()
            buffer[offset + 1] = ((value shr 8) and 0xff).toByte()
            buffer[offset + 2] = ((value shr 16) and 0xff).toByte()
            buffer[offset + 3] = ((value shr 24) and 0xff).toByte()
        }

        private fun writeShortLE(buffer: ByteArray, offset: Int, value: Short) {
            buffer[offset] = (value.toInt() and 0xff).toByte()
            buffer[offset + 1] = ((value.toInt() shr 8) and 0xff).toByte()
        }

        private fun intToLeBytes(value: Int): ByteArray {
            return byteArrayOf(
                (value and 0xff).toByte(),
                ((value shr 8) and 0xff).toByte(),
                ((value shr 16) and 0xff).toByte(),
                ((value shr 24) and 0xff).toByte(),
            )
        }
    }
}
