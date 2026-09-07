import { useSelector } from 'react-redux';
import { useColorScheme } from 'react-native';
import { getThemeColors } from '../theme/colors';

/**
 * Custom hook to access theme colors based on current theme mode
 * @returns {Object} Theme colors object
 */
export const useTheme = () => {
    const appSettings = useSelector(({ appSettings }) => appSettings);
    const systemColorScheme = useColorScheme();
    
    // Theme mode priority: user preference > system preference > light
    const themeMode = appSettings?.themeMode || 'system';
    const isDark = themeMode === 'dark' || (themeMode === 'system' && systemColorScheme === 'dark');
    
    const colors = getThemeColors(isDark);
    
    return {
        colors,
        isDark,
        themeMode,
    };
};

export default useTheme;
