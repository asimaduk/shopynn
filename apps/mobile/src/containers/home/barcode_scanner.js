import React, { useState, useRef } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, Dimensions, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera, useCameraDevice, useCodeScanner, useCameraPermission } from 'react-native-vision-camera';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from '../../components/text';
import config from '../../config';
import ScreenHeader from '../../components/screen_header';
import useTheme from '../../hooks/useTheme';

const { width } = Dimensions.get('window');
const SCAN_AREA_SIZE = width * 0.7;

const BarcodeScanner = ({ navigation, route }) => {
    const { colors } = useTheme();
    const { hasPermission, requestPermission } = useCameraPermission();
    const [barcode, setBarcode] = useState(route.params?.initialBarcode || '');
    const [isActive, setIsActive] = useState(true);
    const [scannedCode, setScannedCode] = useState(null);
    const returnScreen = route.params?.returnScreen || 'NewSale';
    const device = useCameraDevice('back');
    const cameraRef = useRef(null);

    // Code scanner configuration
    const codeScanner = useCodeScanner({
        codeTypes: ['qr', 'ean-13', 'ean-8', 'code-128', 'code-39', 'upc-a', 'upc-e'],
        onCodeScanned: (codes) => {
            if (codes.length > 0 && isActive) {
                const code = codes[0];
                const codeValue = code.value || code.displayValue || '';
                if (codeValue && codeValue !== scannedCode) {
                    setScannedCode(codeValue);
                    setBarcode(codeValue);
                    setIsActive(false);
                    // Auto-navigate after scan
                    setTimeout(() => {
                        handleUseBarcode(codeValue);
                    }, 500);
                }
            }
        },
    });

    const handleUseBarcode = (code = null) => {
        const trimmed = (code || barcode).trim();
        if (!trimmed) return;
        const params = returnScreen === 'Search' ? { barcodeFilter: trimmed } : { scannedBarcode: trimmed };
        navigation.navigate(returnScreen, params);
    };

    const handleManualInput = () => {
        setIsActive(false);
    };

    const handleResumeScanning = () => {
        setScannedCode(null);
        setIsActive(true);
    };

    if (!hasPermission) {
        return (
            <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
                <ScreenHeader onPress={() => navigation.goBack()} label="Barcode Scanner" />
                <View style={styles.permissionContainer}>
                    <Lucide name="camera-off" size={64} color={colors.textTertiary} />
                    <AppText label="Camera permission required" variant={1} fontSize={18} color={colors.text} style={{ marginTop: 20 }} />
                    <AppText label="Enable camera access to scan barcodes" fontSize={14} color={colors.textSecondary} style={{ marginTop: 8, textAlign: 'center', paddingHorizontal: 40 }} />
                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={requestPermission}
                        style={[styles.permissionBtn, { backgroundColor: config.THEME_COLOR }]}
                    >
                        <AppText label="Grant camera access" variant={1} fontSize={16} color={colors.textInverse} />
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    if (!device) {
        return (
            <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
                <ScreenHeader onPress={() => navigation.goBack()} label="Barcode Scanner" />
                <View style={styles.permissionContainer}>
                    <ActivityIndicator size="large" color={config.THEME_COLOR} />
                    <AppText label="Initializing camera..." fontSize={14} color={colors.textSecondary} style={{ marginTop: 16 }} />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
            <ScreenHeader onPress={() => navigation.goBack()} label="Barcode Scanner" />
            
            <View style={styles.container}>
                {/* Camera View */}
                <View style={styles.cameraContainer}>
                    <Camera
                        ref={cameraRef}
                        style={StyleSheet.absoluteFill}
                        device={device}
                        isActive={isActive && hasPermission}
                        codeScanner={codeScanner}
                        orientation="portrait"
                    />
                    
                    {/* Overlay */}
                    <View style={styles.overlay}>
                        {/* Top overlay */}
                        <View style={styles.overlayTop} />
                        
                        {/* Middle section with scan area */}
                        <View style={styles.overlayMiddle}>
                            <View style={styles.overlaySide} />
                            <View style={styles.scanArea}>
                                <View style={[styles.scanCorner, styles.scanCornerTopLeft, { borderColor: config.THEME_COLOR }]} />
                                <View style={[styles.scanCorner, styles.scanCornerTopRight, { borderColor: config.THEME_COLOR }]} />
                                <View style={[styles.scanCorner, styles.scanCornerBottomLeft, { borderColor: config.THEME_COLOR }]} />
                                <View style={[styles.scanCorner, styles.scanCornerBottomRight, { borderColor: config.THEME_COLOR }]} />
                            </View>
                            <View style={styles.overlaySide} />
                        </View>
                        
                        {/* Bottom overlay */}
                        <View style={styles.overlayBottom} />
                    </View>

                    {/* Instructions */}
                    <View style={styles.instructionsContainer}>
                        <AppText 
                            label={isActive ? "Position barcode within the frame" : "Barcode scanned!"} 
                            fontSize={14} 
                            color={colors.textInverse} 
                            style={styles.instructionText}
                        />
                    </View>
                </View>

                {/* Manual Input Section */}
                <View style={[styles.inputSection, { backgroundColor: colors.surface }]}>
                    <View style={styles.inputHeader}>
                        <Lucide name="keyboard" size={20} color={colors.textSecondary} />
                        <AppText label="Or enter manually" fontSize={14} color={colors.textSecondary} style={{ marginLeft: 8 }} />
                    </View>
                    
                    <TextInput
                        placeholder="Type barcode"
                        placeholderTextColor={colors.placeholder}
                        value={barcode}
                        onChangeText={(text) => {
                            setBarcode(text);
                            if (text && isActive) {
                                setIsActive(false);
                            }
                        }}
                        onFocus={handleManualInput}
                        style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text }]}
                        autoCapitalize="none"
                        onSubmitEditing={() => handleUseBarcode()}
                    />
                    
                    <View style={styles.buttonRow}>
                        {!isActive && (
                            <TouchableOpacity 
                                activeOpacity={0.8} 
                                onPress={handleResumeScanning}
                                style={[styles.secondaryBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
                            >
                                <Lucide name="camera" size={18} color={colors.text} />
                                <AppText label="Resume scanning" fontSize={14} color={colors.text} style={{ marginLeft: 6 }} />
                            </TouchableOpacity>
                        )}
                        
                        <TouchableOpacity 
                            activeOpacity={0.8} 
                            onPress={() => handleUseBarcode()} 
                            disabled={!barcode.trim()} 
                            style={[
                                styles.btn, 
                                { backgroundColor: config.THEME_COLOR },
                                !barcode.trim() && styles.btnDisabled
                            ]}
                        >
                            <AppText label="Use barcode" variant={1} color={colors.textInverse} fontSize={16} />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safe: { 
        flex: 1,
    },
    container: {
        flex: 1,
    },
    cameraContainer: {
        flex: 1,
        position: 'relative',
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
    },
    overlayTop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
    },
    overlayMiddle: {
        flexDirection: 'row',
        height: SCAN_AREA_SIZE,
    },
    overlaySide: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
    },
    scanArea: {
        width: SCAN_AREA_SIZE,
        height: SCAN_AREA_SIZE,
        position: 'relative',
    },
    scanCorner: {
        position: 'absolute',
        width: 30,
        height: 30,
        borderWidth: 3,
    },
    scanCornerTopLeft: {
        top: 0,
        left: 0,
        borderRightWidth: 0,
        borderBottomWidth: 0,
    },
    scanCornerTopRight: {
        top: 0,
        right: 0,
        borderLeftWidth: 0,
        borderBottomWidth: 0,
    },
    scanCornerBottomLeft: {
        bottom: 0,
        left: 0,
        borderRightWidth: 0,
        borderTopWidth: 0,
    },
    scanCornerBottomRight: {
        bottom: 0,
        right: 0,
        borderLeftWidth: 0,
        borderTopWidth: 0,
    },
    overlayBottom: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
    },
    instructionsContainer: {
        position: 'absolute',
        top: 100,
        left: 0,
        right: 0,
        alignItems: 'center',
    },
    instructionText: {
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    },
    inputSection: {
        padding: 20,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 8,
    },
    inputHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    input: {
        padding: 16,
        borderRadius: 10,
        fontFamily: 'FiraSans-Regular',
        fontSize: 16,
        borderWidth: 1,
        marginBottom: 16,
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 12,
    },
    btn: {
        flex: 1,
        height: 50,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    btnDisabled: {
        opacity: 0.5,
    },
    secondaryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 50,
        paddingHorizontal: 20,
        borderRadius: 10,
        borderWidth: 1,
    },
    permissionContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    permissionBtn: {
        marginTop: 24,
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default BarcodeScanner;
