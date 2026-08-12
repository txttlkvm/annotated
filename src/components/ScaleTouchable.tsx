import React, { useRef } from 'react';
import { Animated, TouchableOpacity, TouchableOpacityProps } from 'react-native';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export interface ScaleTouchableProps extends TouchableOpacityProps {
  /** How far the surface compresses on press. 1 = no scale. */
  scaleTo?: number;
}

/**
 * TouchableOpacity plus a spring scale on press -- the tactile "give" that
 * was missing everywhere in the app (confirmed live: zero elements anywhere
 * had a transform-based press transition, only the opacity fade
 * TouchableOpacity already provides for free). Drop-in replacement: same
 * props, same activeOpacity fade, plus the scale.
 *
 * useNativeDriver is safe here on both native and web -- RN Web's Animated
 * implementation supports the native driver specifically for transform and
 * opacity, which is all this ever touches.
 */
export default function ScaleTouchable({
  scaleTo = 0.96,
  style,
  onPressIn,
  onPressOut,
  disabled,
  ...rest
}: ScaleTouchableProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn: TouchableOpacityProps['onPressIn'] = (e) => {
    if (!disabled) {
      Animated.spring(scale, {
        toValue: scaleTo,
        useNativeDriver: true,
        speed: 60,
        bounciness: 0,
      }).start();
    }
    onPressIn?.(e);
  };

  const handlePressOut: TouchableOpacityProps['onPressOut'] = (e) => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 8,
    }).start();
    onPressOut?.(e);
  };

  return (
    <AnimatedTouchable
      {...rest}
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[style, { transform: [{ scale }] }]}
    />
  );
}
