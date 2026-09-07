# Theme Responsiveness Implementation Guide

This guide outlines all the changes needed to make the CheqStock app theme responsive (support dark/light mode).

## Overview

The app currently uses hardcoded colors throughout. To make it theme responsive, we need to:
1. ✅ Create theme color definitions (light/dark)
2. ✅ Add theme management to Redux store
3. ✅ Create useTheme hook
4. ⚠️ Replace hardcoded colors in components
5. ⚠️ Update StatusBar based on theme
6. ⚠️ Add theme toggle in settings

## Files Created

### 1. `/src/theme/colors.js`
- Defines light and dark color palettes
- Provides `getThemeColors()` function

### 2. `/src/hooks/useTheme.js`
- Custom hook to access theme colors
- Handles system theme detection
- Returns current theme colors and mode

## Files Modified

### 1. `/src/store/actions/appSettings.js`
- Added `SET_THEME_MODE` action
- Added `setThemeMode()` action creator

### 2. `/src/store/reducers/appSettings.js`
- Added `themeMode` to initial state (default: 'system')
- Added `SET_THEME_MODE` case handler

## Implementation Steps

### Step 1: Update Components to Use Theme Hook

Replace hardcoded colors with theme-aware colors:

**Before:**
```javascript
const styles = StyleSheet.create({
    container: {
        backgroundColor: '#fff',
    },
    text: {
        color: '#333',
    }
});
```

**After:**
```javascript
import useTheme from '../../hooks/useTheme';

const MyComponent = () => {
    const { colors } = useTheme();
    
    const styles = StyleSheet.create({
        container: {
            backgroundColor: colors.surface,
        },
        text: {
            color: colors.text,
        }
    });
    
    return (
        <View style={styles.container}>
            <Text style={styles.text}>Hello</Text>
        </View>
    );
};
```

### Step 2: Common Color Replacements

| Hardcoded Color | Theme Color | Usage |
|----------------|-------------|-------|
| `#fff` or `'#ffffff'` | `colors.surface` | Card backgrounds, modals |
| `#eee` or `'#f8f9fa'` | `colors.background` | Screen backgrounds |
| `#333` or `'#1e293b'` | `colors.text` | Primary text |
| `#666` or `'#64748b'` | `colors.textSecondary` | Secondary text |
| `#999` or `'#94a3b8'` | `colors.textTertiary` | Tertiary text |
| `#ccc` | `colors.border` | Borders, dividers |
| `#f0f0f0` | `colors.borderLight` | Light borders |
| `#f1f3f5` | `colors.inputBackground` | Input backgrounds |
| `#e2e8f0` | `colors.border` | Borders |

### Step 3: Update StatusBar

**File: `/src/navigators/index.js`**

```javascript
import { StatusBar } from 'react-native';
import useTheme from '../hooks/useTheme';

const ApplicationNavigator = () => {
    const { isDark } = useTheme();
    
    return (
        <SafeAreaView style={{flex:1,backgroundColor:'#eee'}}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
            {/* ... */}
        </SafeAreaView>
    );
};
```

### Step 4: Add Theme Toggle to Settings

**File: `/src/containers/home/settings.js`**

Add a theme section with toggle options:

```javascript
import useTheme from '../../hooks/useTheme';
import { setThemeMode } from '../../store/actions/appSettings';

const Settings = ({ navigation }) => {
    const dispatch = useDispatch();
    const { colors, themeMode } = useTheme();
    
    // Add theme section in settings
    <View style={styles.section}>
        <AppText label={'Appearance'} variant={1} fontSize={14} color={colors.textSecondary} />
        <View style={[styles.sectionCard, { backgroundColor: colors.surface }]}>
            <TouchableOpacity onPress={() => dispatch(setThemeMode('light'))}>
                <Text>Light</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => dispatch(setThemeMode('dark'))}>
                <Text>Dark</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => dispatch(setThemeMode('system'))}>
                <Text>System</Text>
            </TouchableOpacity>
        </View>
    </View>
```

### Step 5: Update SafeAreaView Backgrounds

Replace hardcoded background colors in SafeAreaView:

```javascript
// Before
<SafeAreaView style={{ flex: 1, backgroundColor: '#eee' }}>

// After
const { colors } = useTheme();
<SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
```

### Step 6: Update Common Components

#### Header Component
- Replace `#fff` with `colors.surface`
- Replace text colors with `colors.text`

#### Cards
- Replace `backgroundColor: '#fff'` with `colors.surface`
- Replace `borderColor: '#eee'` with `colors.border`

#### Input Fields
- Replace `backgroundColor: '#f1f3f5'` with `colors.inputBackground`
- Replace `borderColor: '#eee'` with `colors.inputBorder`
- Replace `placeholderTextColor: '#999'` with `colors.placeholder`

#### Buttons
- Keep theme colors (primary) but adjust text colors based on theme

## Priority Files to Update

1. **High Priority:**
   - `/src/containers/home/dashboard.js`
   - `/src/containers/home/sales.js`
   - `/src/containers/home/purchases.js`
   - `/src/containers/home/inventory.js`
   - `/src/components/main_header.js`
   - `/src/components/screen_header.js`

2. **Medium Priority:**
   - All settings screens
   - All form screens (new_sale, new_purchase, etc.)
   - Modal components

3. **Low Priority:**
   - Auth screens
   - Utility screens

## Testing Checklist

- [ ] Toggle between light/dark/system themes
- [ ] Verify all screens adapt correctly
- [ ] Check StatusBar updates
- [ ] Verify text readability in both themes
- [ ] Test modals and overlays
- [ ] Verify input fields are visible
- [ ] Check button contrast
- [ ] Verify images/icons visibility

## Notes

- The `useTheme` hook automatically detects system theme when `themeMode` is set to 'system'
- Theme preference is persisted via Redux Persist
- Some components may need custom theme colors (e.g., charts, graphs)
- Consider adding theme transition animations for smoother UX
