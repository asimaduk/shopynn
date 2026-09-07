import { StyleSheet } from 'react-native';
import config from '../../config';

export default StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    headerActions: {
        flexDirection: 'row',
        paddingVertical: 5,
        marginRight: 10,
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
    },
    listContent: {
        padding: 15,
        paddingBottom: 80,
    },
    itemContainer: {
        backgroundColor: '#fff',
        borderRadius: 8,
        marginBottom: 10,
        padding: 15,
        flexDirection: 'row',
        alignItems: 'center',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        // borderLeftWidth: 3,
        // borderLeftColor: config.THEME_COLOR,
    },
    itemIndex: {
        width: 20,
        textAlign: 'center',
        color: '#888',
        fontWeight: 'bold',
        marginRight: 10,
    },
    itemContent: {
        flex: 1,
        justifyContent: 'center',
    },
    itemName: {
        fontSize: 15,
        marginBottom: 4,
        fontFamily: 'FiraSans-SemiBold',
    },
    itemDetail: {
        fontSize: 12,
        color: '#666',
        fontFamily: 'FiraSans-Regular',
        marginBottom: 2
    },
    itemPriceContainer: {
        alignItems: 'flex-end',
        marginLeft: 10,
    },
    itemPrice: {
        fontSize: 16,
        color: config.THEME_COLOR,
        fontFamily: 'FiraSans-SemiBold',
    },
    currency: {
        fontSize: 10,
        color: '#888',
        marginTop: 2
    }
});
