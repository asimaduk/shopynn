import { Text } from 'react-native';

const AppText = ({ label, fontSize, variant, color, style, numberOfLines }) => {

    return (
        <Text numberOfLines={numberOfLines || undefined} style={[{color: color || '#333', fontSize: fontSize || 15, fontFamily: variant==1 ? 'FiraSans-SemiBold':'FiraSans-Regular'}, (style && style)]}>{label}</Text>
    )
}

export default AppText;