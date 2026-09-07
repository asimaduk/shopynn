// Theme color definitions for light and dark modes
export const lightColors = {
    // Backgrounds
    background: '#f8f9fa',
    surface: '#ffffff',
    surfaceSecondary: '#f1f3f5',
    surfaceTertiary: '#e9ecef',
    
    // Text
    text: '#1e293b',
    textSecondary: '#64748b',
    textTertiary: '#94a3b8',
    textInverse: '#ffffff',
    
    // Borders & Dividers
    border: '#e2e8f0',
    borderLight: '#f1f5f9',
    divider: '#e2e8f0',
    
    // Status colors
    success: '#10b981',
    successLight: '#d1fae5',
    warning: '#f59e0b',
    warningLight: '#fef3c7',
    error: '#ef4444',
    errorLight: '#fee2e2',
    info: '#00A4EF',
    infoLight: '#d6eefc',
    
    // Theme colors (ims-web default palette)
    primary: '#0A74DA',
    primaryLight: '#6BC9F7',
    primaryShade: '#e8f4fc',
    
    // Shadows
    shadow: 'rgba(0, 0, 0, 0.1)',
    shadowLight: 'rgba(0, 0, 0, 0.05)',
    
    // Inputs
    inputBackground: '#f1f3f5',
    inputBorder: '#e2e8f0',
    placeholder: '#94a3b8',
    
    // Cards
    cardBackground: '#ffffff',
    cardBorder: '#e2e8f0',
};

export const darkColors = {
    // Backgrounds
    background: '#0f172a',
    surface: '#1e293b',
    surfaceSecondary: '#334155',
    surfaceTertiary: '#475569',
    
    // Text
    text: '#f1f5f9',
    textSecondary: '#cbd5e1',
    textTertiary: '#94a3b8',
    textInverse: '#1e293b',
    
    // Borders & Dividers
    border: '#334155',
    borderLight: '#475569',
    divider: '#334155',
    
    // Status colors
    success: '#10b981',
    successLight: '#064e3b',
    warning: '#f59e0b',
    warningLight: '#78350f',
    error: '#ef4444',
    errorLight: '#7f1d1d',
    info: '#00A4EF',
    infoLight: '#142a45',
    
    // Theme colors (ims-web defaultDark primary / secondary)
    primary: '#0A74DA',
    primaryLight: '#6BC9F7',
    primaryShade: '#0f2540',
    
    // Shadows
    shadow: 'rgba(0, 0, 0, 0.3)',
    shadowLight: 'rgba(0, 0, 0, 0.2)',
    
    // Inputs
    inputBackground: '#334155',
    inputBorder: '#475569',
    placeholder: '#64748b',
    
    // Cards
    cardBackground: '#1e293b',
    cardBorder: '#334155',
};

export const getThemeColors = (isDark) => {
    return isDark ? darkColors : lightColors;
};
