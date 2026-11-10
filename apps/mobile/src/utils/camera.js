import { PermissionsAndroid, Platform } from 'react-native';
import { launchCamera as pickerLaunchCamera } from 'react-native-image-picker';
import AppAlert from './appAlert';

/** Android refuses the camera intent once CAMERA is in the manifest unless it has been granted. */
async function ensureCameraPermission() {
    if (Platform.OS !== 'android') return true;
    const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA, {
        title: 'Camera access',
        message: 'Shopynn needs the camera to take photos and scan barcodes.',
        buttonPositive: 'Allow',
        buttonNegative: 'Not now',
    });
    return granted === PermissionsAndroid.RESULTS.GRANTED;
}

export async function launchCamera(options) {
    if (!(await ensureCameraPermission())) {
        AppAlert.alert('Camera access needed', 'Allow camera access in Settings to take a photo.');
        return { didCancel: true };
    }
    return pickerLaunchCamera(options);
}
