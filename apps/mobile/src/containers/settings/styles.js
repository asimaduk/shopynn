import { StyleSheet } from 'react-native';
import config from '../../config';

export default StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    headerActions: {
        flexDirection: 'row',
        // paddingVertical: 5,
        marginRight: 5,
    },
    actionButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 10,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        marginRight: 10,
        marginBottom: 5
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 30,
        marginHorizontal: 15,
        paddingHorizontal: 15,
        marginTop: 15,
        height: 50,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    searchInput: {
        flex: 1,
        height: '100%',
        marginLeft: 10,
        fontSize: 16,
        fontFamily: 'FiraSans-Regular',
        color: '#333',
    },
    listContent: {
        paddingTop: 15,
        paddingHorizontal: 5,
        paddingBottom: 80, // Add padding for bottom
    },
    listHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15,
        padding: 15,
        borderRadius: 5,
    },
    itemContainer: {
        backgroundColor: '#fff',
        borderRadius: 5,
        marginBottom: 12,
        padding: 15,
        flexDirection: 'row',
        alignItems: 'center',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    itemIndex: {
        marginRight: 5,
        width: 25,
        textAlign: 'center',
        color: '#888',
        fontWeight: 'bold',
    },
    itemContent: {
        flex: 1,
    },
    itemName: {
        fontSize: 16,
        color: '#333',
        marginBottom: 4,
        fontFamily: 'FiraSans-SemiBold',
    },
    itemDetail: {
        fontSize: 13,
        color: '#666',
        fontFamily: 'FiraSans-Regular',
    },
    itemArrow: {
        marginLeft: 10,
    },
});
