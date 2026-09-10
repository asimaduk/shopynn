import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Image, Dimensions, ScrollView, Platform, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import Animated, {
    useAnimatedScrollHandler,
    useAnimatedStyle,
    useSharedValue,
    interpolate,
    Extrapolation,
} from 'react-native-reanimated';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from '../../components/text';
import config from '../../config';
import useTheme from '../../hooks/useTheme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const IMAGE_HEIGHT = SCREEN_HEIGHT * 0.45;
const DOT_SIZE = 8;
const DOT_EXPANDED = 24;
const AUTO_SCROLL_MS = 4500;

const SLIDES = [
    {
        id: '1',
        imageUri: 'https://plus.unsplash.com/premium_vector-1682270037677-94032baab5f0?q=80&w=2394&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',//'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=800',
        title: 'Track Stock in Real Time',
        subtitle: 'Know exactly what you have, where it is, and when to reorder. Keep your inventory accurate across all locations.',
    },
    {
        id: '2',
        imageUri: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0',
        title: 'Customer Ordering',
        subtitle: 'Let customers browse your catalog, add items to cart, and place orders from the app. You fulfill requests while they shop anytime.',
    },
    {
        id: '3',
        imageUri: 'https://plus.unsplash.com/premium_vector-1723136576984-588e6a49648d?q=80&w=1480&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
        title: 'Sales & Purchases',
        subtitle: 'Record sales and purchases in one place. Manage orders, invoices, and suppliers without the paperwork.',
    },
    {
        id: '4',
        imageUri: 'https://images.unsplash.com/vector-1738924826735-c2e739a59ab0?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NHx8aW52ZW50b3J5JTIwbWFuYWdlbWVudCUyMGJhciUyMGNvZGUlMjBzY2FufGVufDB8fDB8fHww',//'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=800',
        title: 'Barcode & Voice Scan',
        subtitle: 'Scan products to add or sell in seconds. Speed up checkout and stock counts with barcode support.',
    },
    {
        id: '5',
        imageUri: 'https://plus.unsplash.com/premium_vector-1736875279065-da8db370322b?q=80&w=1480&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',//'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800',
        title: 'Reports & Insights',
        subtitle: 'View stock levels, sales trends, and profit at a glance. Make better decisions with clear reports.',
    },
];

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

const GetStarted = ({ navigation }) => {
    const { colors, isDark } = useTheme();
    const isFocused = useIsFocused();
    const scrollX = useSharedValue(0);
    const [currentIndex, setCurrentIndex] = useState(0);
    const scrollRef = useRef(null);
    const autoScrollTimerRef = useRef(null);
    const isDraggingRef = useRef(false);
    const slideIndexRef = useRef(0);

    const clearAutoScrollTimer = useCallback(() => {
        if (autoScrollTimerRef.current) {
            clearInterval(autoScrollTimerRef.current);
            autoScrollTimerRef.current = null;
        }
    }, []);

    const scrollToSlide = useCallback((index, animated = true) => {
        const safeIndex = ((index % SLIDES.length) + SLIDES.length) % SLIDES.length;
        slideIndexRef.current = safeIndex;
        setCurrentIndex(safeIndex);
        scrollRef.current?.scrollTo({ x: safeIndex * SCREEN_WIDTH, animated });
    }, []);

    const advanceSlide = useCallback(() => {
        scrollToSlide(slideIndexRef.current + 1);
    }, [scrollToSlide]);

    const startAutoScroll = useCallback(() => {
        clearAutoScrollTimer();
        autoScrollTimerRef.current = setInterval(advanceSlide, AUTO_SCROLL_MS);
    }, [advanceSlide, clearAutoScrollTimer]);

    const pauseAutoScroll = useCallback(() => {
        clearAutoScrollTimer();
    }, [clearAutoScrollTimer]);

    const resumeAutoScroll = useCallback(() => {
        startAutoScroll();
    }, [startAutoScroll]);

    useEffect(() => {
        startAutoScroll();
        return clearAutoScrollTimer;
    }, [startAutoScroll, clearAutoScrollTimer]);

    useFocusEffect(
        useCallback(() => {
            StatusBar.setBarStyle('light-content', true);
            if (Platform.OS === 'android') {
                StatusBar.setTranslucent(true);
                StatusBar.setBackgroundColor(config.THEME_COLOR, true);
            }
            // Do not reset barStyle on blur — the next screen's focus effect owns it.
            return undefined;
        }, []),
    );

    const scrollHandler = useAnimatedScrollHandler({
        onScroll: (event) => {
            scrollX.value = event.contentOffset.x;
        },
    });

    const onMomentumScrollEnd = useCallback(
        (e) => {
            const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
            slideIndexRef.current = index;
            setCurrentIndex(index);
            isDraggingRef.current = false;
            resumeAutoScroll();
        },
        [resumeAutoScroll],
    );

    const onScrollBeginDrag = useCallback(() => {
        isDraggingRef.current = true;
        pauseAutoScroll();
    }, [pauseAutoScroll]);

    const onTouchStart = useCallback(() => {
        pauseAutoScroll();
    }, [pauseAutoScroll]);

    const onTouchEnd = useCallback(() => {
        if (!isDraggingRef.current) {
            resumeAutoScroll();
        }
    }, [resumeAutoScroll]);

    const goToLogin = () => {
        navigation.replace('Login');
    };

    const skip = () => {
        goToLogin();
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.surface }]}>
            {isFocused ? (
                <StatusBar
                    animated
                    translucent
                    barStyle="light-content"
                    backgroundColor={config.THEME_COLOR}
                />
            ) : null}
            <SafeAreaView style={styles.safeArea} edges={['top']}>
                <View style={styles.skipRow}>
                    <TouchableOpacity activeOpacity={0.8} onPress={skip} style={styles.skipBtn}>
                        <AppText label="Skip" fontSize={15} color={colors.textSecondary} />
                    </TouchableOpacity>
                </View>

                <AnimatedScrollView
                    ref={scrollRef}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    onScroll={scrollHandler}
                    onScrollBeginDrag={onScrollBeginDrag}
                    onMomentumScrollEnd={onMomentumScrollEnd}
                    onTouchStart={onTouchStart}
                    onTouchEnd={onTouchEnd}
                    onTouchCancel={onTouchEnd}
                    scrollEventThrottle={16}
                    decelerationRate="fast"
                    bounces={false}
                    style={styles.scrollView}>
                    {SLIDES.map((slide, index) => (
                        <SlideItem key={slide.id} slide={slide} index={index} scrollX={scrollX} />
                    ))}
                </AnimatedScrollView>

                <View style={styles.footer}>
                    <PaginationDots count={SLIDES.length} scrollX={scrollX} />
                    <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={goToLogin}
                        style={styles.getStartedBtn}>
                        <AppText label="Get Started" variant={1} fontSize={17} color={colors.textInverse} />
                        <Lucide name="move-right" color={colors.textInverse} size={20} style={{ marginLeft: 10 }} />
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </View>
    );
};

function SlideItem({ slide, index, scrollX }) {
    const { colors } = useTheme();
    const animatedImageStyle = useAnimatedStyle(() => {
        const inputRange = [
            (index - 1) * SCREEN_WIDTH,
            index * SCREEN_WIDTH,
            (index + 1) * SCREEN_WIDTH,
        ];
        const scale = interpolate(scrollX.value, inputRange, [0.85, 1, 0.85], Extrapolation.CLAMP);
        const opacity = interpolate(scrollX.value, inputRange, [0.6, 1, 0.6], Extrapolation.CLAMP);
        return { transform: [{ scale }], opacity };
    });

    const animatedTextStyle = useAnimatedStyle(() => {
        const inputRange = [
            (index - 1) * SCREEN_WIDTH,
            index * SCREEN_WIDTH,
            (index + 1) * SCREEN_WIDTH,
        ];
        const translateY = interpolate(scrollX.value, inputRange, [40, 0, 40], Extrapolation.CLAMP);
        const opacity = interpolate(scrollX.value, inputRange, [0, 1, 0], Extrapolation.CLAMP);
        return { transform: [{ translateY }], opacity };
    });

    return (
        <View style={styles.slide}>
            <Animated.View style={[styles.imageWrap, animatedImageStyle]}>
                <Image source={{ uri: slide.imageUri }} style={styles.image} resizeMode="cover" />
                <View style={styles.imageOverlay} />
            </Animated.View>
            <Animated.View style={[styles.textWrap, animatedTextStyle]}>
                <AppText label={slide.title} variant={1} fontSize={24} color={colors.text} style={styles.title} />
                <AppText
                    label={slide.subtitle}
                    fontSize={15}
                    color={colors.textSecondary}
                    style={styles.subtitle}
                />
            </Animated.View>
        </View>
    );
}

function PaginationDots({ count, scrollX }) {
    return (
        <View style={styles.dotsRow}>
            {Array.from({ length: count }).map((_, index) => {
                return <Dot key={index} index={index} scrollX={scrollX} />;
            })}
        </View>
    );
}

function Dot({ index, scrollX }) {
    const animatedStyle = useAnimatedStyle(() => {
        const inputRange = [
            (index - 1) * SCREEN_WIDTH,
            index * SCREEN_WIDTH,
            (index + 1) * SCREEN_WIDTH,
        ];
        const width = interpolate(scrollX.value, inputRange, [DOT_SIZE, DOT_EXPANDED, DOT_SIZE], Extrapolation.CLAMP);
        const opacity = interpolate(scrollX.value, inputRange, [0.4, 1, 0.4], Extrapolation.CLAMP);
        return { width, opacity };
    });

    return <Animated.View style={[styles.dot, animatedStyle]} />;
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    safeArea: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    skipRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 16,
    },
    skipBtn: {
        paddingVertical: 8,
        paddingHorizontal: 4,
    },
    scrollView: {
        flex: 1,
    },
    slide: {
        width: SCREEN_WIDTH,
        flex: 1,
        paddingHorizontal: 28,
        paddingBottom: 24,
    },
    imageWrap: {
        width: SCREEN_WIDTH,
        height: IMAGE_HEIGHT,
        // marginHorizontal: -28,
        overflow: 'hidden',
        marginBottom: 32,
        borderTopLeftRadius:5,
        borderBottomLeftRadius:5
    },
    image: {
        width: '100%',
        height: '100%',
    },
    imageOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(15, 23, 42, 0.35)',
    },
    textWrap: {
        paddingHorizontal: 4,
    },
    title: {
        marginBottom: 12,
        textAlign: 'center',
    },
    subtitle: {
        textAlign: 'center',
        lineHeight: 22,
    },
    footer: {
        paddingHorizontal: 24,
        paddingBottom: 32,
        paddingTop: 16,
    },
    dotsRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 28,
        gap: 8,
    },
    dot: {
        height: DOT_SIZE,
        borderRadius: DOT_SIZE / 2,
        backgroundColor: config.THEME_COLOR || '#0A74DA',
    },
    getStartedBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 56,
        backgroundColor: config.THEME_COLOR || '#0A74DA',
        borderRadius: 5,
    },
});

export default GetStarted;
