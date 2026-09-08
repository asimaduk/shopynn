import { KeyboardAvoidingView, Modal, Platform, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from './text';
import useTheme from '../hooks/useTheme';

const AppModal = ({ visible, title, handleClose, onRequestClose, children }) => {
    const { colors, isDark } = useTheme();
    
    // Backdrop color adapts to theme - darker in light mode, lighter in dark mode
    const backdropColor = isDark ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.5)';
    
    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={onRequestClose}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{flex:1}}>
                <SafeAreaView style={{flex:1,backgroundColor:backdropColor}}>
                    <TouchableOpacity onPress={handleClose} activeOpacity={.6} style={{flex:1}}/>
                    <View style={{backgroundColor:colors.surface,borderTopLeftRadius:10,borderTopRightRadius:10}}>
                        <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingHorizontal:14,paddingTop:14,paddingBottom:12,borderBottomWidth:1,borderBottomColor:colors.border}}>
                            <AppText label={title} variant={1} color={colors.text} />
                            <TouchableOpacity
                                activeOpacity={.6}
                                onPress={handleClose}
                                style={{width:40,height:40,justifyContent:'center',alignItems:'center'}}>
                                <Lucide name='x' size={20} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>
                        {children}
                    </View>
                </SafeAreaView>
            </KeyboardAvoidingView>
        </Modal>
    )
}

export default AppModal;