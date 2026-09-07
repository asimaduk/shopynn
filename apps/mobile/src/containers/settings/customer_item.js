import React from 'react';
import { View, TouchableOpacity, Image } from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import styles from './styles';
import AppText from '../../components/text';
import config from '../../config';
import useTheme from '../../hooks/useTheme';

const CustomerItem = ({ item, index, onPress, onEdit }) => {
    const { colors } = useTheme();
    const initials =
        `${item.name?.split(' ')[0]?.[0] || ''}${item.name?.split(' ')[1]?.[0] || ''}`.toUpperCase() || 'C';

    return (
        <TouchableOpacity
            activeOpacity={0.7}
            onPress={onPress}
            style={[
                styles.itemContainer,
                {
                    backgroundColor: colors.surface,
                    borderRadius: 10,
                    paddingVertical: 8,
                    paddingHorizontal: 10,
                    marginHorizontal: 10,
                    marginBottom: 6
                },
            ]}
        >
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <View
                    style={{
                        width: 32,
                        height: 32,
                        borderRadius: 16,
                        backgroundColor: colors.surfaceSecondary,
                        justifyContent: 'center',
                        alignItems: 'center',
                        marginRight: 10,
                    }}
                >
                    {item.image ? (
                        <Image source={{ uri: item.image }} style={{ width: 32, height: 32, borderRadius: 16 }} />
                    ) : (
                        <AppText label={initials} fontSize={13} color={colors.text} />
                    )}
                </View>

                    <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <AppText
                            label={item.name || 'Unnamed customer'}
                            style={[styles.itemName, { color: colors.text }]}
                            numberOfLines={1}
                        />
                        <AppText
                            label={`#${index + 1}`}
                            fontSize={10}
                            color={colors.textTertiary}
                            style={{ marginLeft: 6 }}
                        />
                    </View>
                    {item.source === 'account' ? (
                        <AppText
                            label="App signup"
                            fontSize={10}
                            color={config.THEME_COLOR}
                            style={{ marginTop: 2 }}
                            fontFamily="FiraSans-Medium"
                        />
                    ) : item.source === 'pos' ? (
                        <AppText
                            label="POS / admin"
                            fontSize={10}
                            color={colors.textTertiary}
                            style={{ marginTop: 2 }}
                            fontFamily="FiraSans-Medium"
                        />
                    ) : null}
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                        <Lucide name="phone" size={11} color={colors.textSecondary} style={{ marginRight: 4 }} />
                        <AppText
                            label={item.phone || 'No phone'}
                            style={[styles.itemDetail, { color: colors.textSecondary }]}
                            numberOfLines={1}
                        />
                    </View>
                    {item.address ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 1 }}>
                            <Lucide name="map-pin" size={11} color={colors.textSecondary} style={{ marginRight: 4 }} />
                            <AppText
                                label={item.address}
                                style={[styles.itemDetail, { color: colors.textSecondary }]}
                                numberOfLines={1}
                            />
                        </View>
                    ) : null}
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 8 }}>
                    {onEdit && (
                        <TouchableOpacity
                            onPress={onEdit}
                            activeOpacity={0.6}
                            style={{ paddingHorizontal: 6, paddingVertical: 4, marginRight: 4 }}
                        >
                            <Lucide name="pencil" color={colors.textTertiary} size={16} />
                        </TouchableOpacity>
                    )}
                    <Lucide name="chevron-right" color={colors.textTertiary} size={16} />
                </View>
            </View>
        </TouchableOpacity>
    );
};

export default CustomerItem;
