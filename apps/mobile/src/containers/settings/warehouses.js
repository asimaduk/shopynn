import React, { useState, useEffect, useCallback } from 'react';
import { TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from '../../components/text';
import ScreenHeader from '../../components/screen_header';
import { FlashList } from '@shopify/flash-list';
import styles from './styles';
import WarehouseItem from './warehouse_item';
import config from '../../config';
import useTheme from '../../hooks/useTheme';
import { warehouses as warehousesApi, normalizeList } from '../../services/api';
import { useFocusEffect } from '@react-navigation/native';

// const initialData = [
//     { id: '1', name: 'Adjiringano Annex', location: 'East Legon', manager: 'K. Johnson' },
//     { id: '2', name: 'Main Warehouse', location: 'Spintex Road', manager: 'A. Smith' },
//     { id: '3', name: 'Accra Central Store', location: 'Makola', manager: 'B. Doe' },
//     { id: '4', name: 'Tema Port Depot', location: 'Tema', manager: 'C. Brown' },
//     { id: '5', name: 'Kumasi Distribution', location: 'Adum', manager: 'D. White' },
// ];

const Warehouses = ({ navigation }) => {
    const { colors } = useTheme();
    const [searchText, setSearchText] = useState('');
    const [showSearch, setShowSearch] = useState(false);
    const [list, setList] = useState([]);

    const loadWarehouses = useCallback(async () => {
        try {
            const raw = await warehousesApi.list();
            console.log(raw);
            const items = normalizeList(raw);
            setList(Array.isArray(items) && items.length > 0 ? items : []);
        } catch (_) {
            setList([]);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadWarehouses();
        }, [loadWarehouses])
    );

    useEffect(() => {
        loadWarehouses();
    }, [loadWarehouses]);

    const backPress = () => {
        navigation.goBack();
    };

    const data = !searchText.trim()
        ? list
        : list.filter(item =>
            item.name?.toLowerCase().includes(searchText.toLowerCase()) ||
            item.location?.toLowerCase().includes(searchText.toLowerCase())
        );

    const handleSearch = (text) => {
        setSearchText(text);
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <ScreenHeader onPress={backPress} label={'Warehouses / Stores'}>
                <View style={styles.headerActions}>
                    <TouchableOpacity
                        activeOpacity={0.6}
                        onPress={() => {
                            setShowSearch((prev) => {
                                const next = !prev;
                                if (!next) handleSearch('');
                                return next;
                            });
                        }}
                        style={[styles.actionButton, { backgroundColor: colors.surface }]}>
                        <Lucide name={showSearch ? 'x' : 'search'} color={colors.text} size={20} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        activeOpacity={0.6}
                        onPress={() => navigation.navigate('CreateWarehouse')}
                        style={[styles.actionButton, { backgroundColor: colors.surface }]}>
                        <Lucide name="plus" color={config.THEME_COLOR} size={20} />
                    </TouchableOpacity>
                </View>
            </ScreenHeader>

            {showSearch ? (
                <View style={[styles.searchContainer, { backgroundColor: colors.surface }]}>
                    <Lucide name="search" color={colors.textTertiary} size={18} />
                    <TextInput
                        style={[styles.searchInput, { color: colors.text }]}
                        placeholder="Search warehouses..."
                        placeholderTextColor={colors.placeholder}
                        value={searchText}
                        onChangeText={handleSearch}
                        autoCorrect={false}
                        autoCapitalize="none"
                        returnKeyType="search"
                    />
                    {searchText.length > 0 ? (
                        <TouchableOpacity onPress={() => handleSearch('')}>
                            <Lucide name="x" color={colors.textTertiary} size={18} />
                        </TouchableOpacity>
                    ) : null}
                </View>
            ) : null}

            <FlashList
                contentContainerStyle={styles.listContent}
                data={data}
                estimatedItemSize={80}
                showsVerticalScrollIndicator={false}
                ListHeaderComponent={() => (
                    <View style={[styles.listHeader, { backgroundColor: colors.surface }]}>
                        <Lucide name="store" color={config.THEME_COLOR} size={20} />
                        <AppText label={`${data.length} Stores Found`} fontSize={16} variant={1} style={{ marginLeft: 10 }} color={colors.text} />
                    </View>
                )}
                keyExtractor={(item) => item.id}
                renderItem={({ item, index }) => (
                    <WarehouseItem
                        item={item}
                        index={index}
                        navigation={navigation}
                    />
                )}
                ListEmptyComponent={() => (
                    <View style={{ alignItems: 'center', marginTop: 50 }}>
                        <AppText label="No warehouses found" color={colors.textTertiary} />
                    </View>
                )}
            />
        </SafeAreaView>
    )
}

export default Warehouses;