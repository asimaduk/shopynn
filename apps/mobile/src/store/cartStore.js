let cartItems = [];
const listeners = new Set();

const emit = () => {
    const snapshot = [...cartItems];
    listeners.forEach((cb) => cb(snapshot));
};

export const getCartItems = () => [...cartItems];

export const subscribeCart = (cb) => {
    listeners.add(cb);
    cb([...cartItems]);
    return () => listeners.delete(cb);
};

export const clearCart = () => {
    cartItems = [];
    emit();
};

export const removeCartItem = (key) => {
    cartItems = cartItems.filter((item) => item.key !== key);
    emit();
};

export const updateCartItemQty = (key, quantity) => {
    cartItems = cartItems.map((item) => (item.key === key ? { ...item, quantity } : item));
    emit();
};

export const addToCart = (item) => {
    const key = `${item.warehouse_id}:${item.product_id}`;
    const exists = cartItems.find((it) => it.key === key);
    if (exists) {
        cartItems = cartItems.map((it) =>
            it.key === key
                ? { ...it, quantity: Number(it.quantity || 0) + Number(item.quantity || 0) }
                : it
        );
    } else {
        cartItems = [
            ...cartItems,
            {
                ...item,
                key,
            },
        ];
    }
    emit();
};
