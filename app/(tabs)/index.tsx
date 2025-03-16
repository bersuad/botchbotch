import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Dimensions, Vibration, Animated } from 'react-native';
import { Accelerometer } from 'expo-sensors';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';

const { width, height } = Dimensions.get('window');
const DOT_SIZE = 50;
const SHAKE_THRESHOLD = 1.5;
const SHAKE_MULTIPLIER = 70;
const SOUND_DELAY = 248.8;
const RECT_HEIGHT = height * 0.35;
const CENTER_POSITION = { x: width / 2 - DOT_SIZE / 2, y: height / 2 - DOT_SIZE / 2 };

const RECT_X = 0;
const RECT_WIDTH = width;
const TOP_RECT_Y = height / 2 - RECT_HEIGHT;
const BOTTOM_RECT_Y = height / 2;

export default function App() {
  const positionAnim = useRef(new Animated.ValueXY(CENTER_POSITION)).current;
  const lastAcceleration = useRef({ x: 0, y: 0 });
  const moveBackTimeout = useRef(null);
  const lastSoundTime = useRef(0);
  const lastShakeTime = useRef(Date.now());
  const [isInRect, setIsInRect] = useState(false);

  const playSound = async (file) => {
    const currentTime = Date.now();
    if (currentTime - lastSoundTime.current > SOUND_DELAY) {
      const { sound } = await Audio.Sound.createAsync(file, { isLooping: false, volume: 1 });
      await sound.playAsync();
      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isPlaying) sound.unloadAsync();
      });
      lastSoundTime.current = currentTime;
    }
  };

  const triggerFeedback = (speed) => {
    const hapticStyle =
      speed > 2.5
        ? Haptics.ImpactFeedbackStyle.Heavy
        : speed > 1.8
        ? Haptics.ImpactFeedbackStyle.Medium
        : Haptics.ImpactFeedbackStyle.Light;

    const vibrationDuration = speed * 50; // Dynamic vibration based on speed
    Vibration.vibrate(vibrationDuration);
    Haptics.impactAsync(hapticStyle);
  };

  const bounceToPosition = (x, y) => {
    Animated.spring(positionAnim, {
      toValue: { x, y },
      bounciness: 10,
      speed: 12,
      useNativeDriver: false,
    }).start();
  };

  const fallToBottom = () => {
    const bottomY = BOTTOM_RECT_Y + RECT_HEIGHT - DOT_SIZE;
    bounceToPosition(positionAnim.x._value, bottomY);
  };

  const isRectHit = (y) => {
    return (
      (y >= TOP_RECT_Y && y <= TOP_RECT_Y + RECT_HEIGHT - DOT_SIZE) ||
      (y >= BOTTOM_RECT_Y && y <= BOTTOM_RECT_Y + RECT_HEIGHT - DOT_SIZE)
    );
  };

  const handleShake = ({ x, y, z }) => {
    const deltaX = x - lastAcceleration.current.x;
    const deltaY = y - lastAcceleration.current.y;
    const deltaZ = z - lastAcceleration.current.z;
    const speed = Math.sqrt(deltaX ** 2 + deltaY ** 2 + deltaZ ** 2);

    if (speed > SHAKE_THRESHOLD) {
      lastShakeTime.current = Date.now();

      let newX = Math.max(RECT_X, Math.min(RECT_WIDTH - DOT_SIZE, positionAnim.x._value + x * SHAKE_MULTIPLIER));
      let newY = Math.max(BOTTOM_RECT_Y, Math.min(BOTTOM_RECT_Y + RECT_HEIGHT - DOT_SIZE, positionAnim.y._value + y * SHAKE_MULTIPLIER));

      bounceToPosition(newX, newY);

      if (isRectHit(newY)) {
        if (!isInRect) {
          triggerFeedback(speed);
          playSound(require('../../assets/sounds/hit.mp3'));
          setIsInRect(true);
        }
      } else if (isInRect) {
        setIsInRect(false);
        Vibration.cancel();
      }

      clearTimeout(moveBackTimeout.current);
      moveBackTimeout.current = setTimeout(() => {
        if (Date.now() - lastShakeTime.current > 500) {
          fallToBottom();
        }
      }, 500);
    }

    lastAcceleration.current = { x, y, z };
  };

  useEffect(() => {
    const subscription = Accelerometer.addListener(handleShake);
    return () => subscription.remove();
  }, []);

  return (
    <View style={styles.container}>
      <View style={[styles.rect, styles.topRect]} />
      <View style={[styles.rect, styles.bottomRect]} />
      <Animated.View style={[styles.dot, positionAnim.getLayout()]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rect: {
    position: 'absolute',
    width: '100%',
    height: RECT_HEIGHT,
    backgroundColor: 'red',
  },
  topRect: {
    top: TOP_RECT_Y,
  },
  bottomRect: {
    top: BOTTOM_RECT_Y,
  },
  dot: {
    position: 'absolute',
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: 'blue',
  },
});
