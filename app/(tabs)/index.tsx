import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Dimensions, Vibration, Animated } from 'react-native';
import { Accelerometer } from 'expo-sensors';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';

const { width, height } = Dimensions.get('window');
const DOT_SIZE = 50;
const SHAKE_THRESHOLD = 1.5;
const SHAKE_MULTIPLIER = 70;
const CENTER_POSITION = { x: width / 2 - DOT_SIZE / 2, y: height / 2 - DOT_SIZE / 2 };

const RECT_HEIGHT = height * 0.35;
const RECT_WIDTH = width;
const RECT_X = 0;
const TOP_RECT_Y = height / 2 - RECT_HEIGHT;
const BOTTOM_RECT_Y = height / 2;
const SOUND_DELAY = 229;

export default function App() {
  const positionAnim = useRef(new Animated.ValueXY(CENTER_POSITION)).current;
  const lastAcceleration = useRef({ x: 0, y: 0 });
  const moveBackTimeout = useRef(null);
  const [isInRect, setIsInRect] = useState(false);
  const lastSoundTime = useRef(0);

  const playSound = async () => {
    const currentTime = Date.now();

    if (currentTime - lastSoundTime.current > SOUND_DELAY) {
      const { sound } = await Audio.Sound.createAsync(require('../../assets/sounds/hit.mp3'), {
        isLooping: false,
        volume: 1,
      });

      await sound.playAsync();

      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isPlaying) {
          sound.unloadAsync();
        }
      });

      lastSoundTime.current = currentTime;
    }
  };

  const triggerFeedback = () => {
    Vibration.vibrate(100);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  };

  const stopFeedback = () => {
    Vibration.cancel();
  };

  const bounceEffect = (newX, newY) => {
    Animated.spring(positionAnim, {
      toValue: { x: newX, y: newY },
      bounciness: 10,
      speed: 12,
      useNativeDriver: false,
    }).start();
  };

  const moveToCenter = () => {
    Animated.spring(positionAnim, {
      toValue: CENTER_POSITION,
      useNativeDriver: false,
      bounciness: 8,
      speed: 12,
    }).start();
    setIsInRect(false);
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
    const speed = Math.sqrt(deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ);

    if (speed > SHAKE_THRESHOLD) {
      let newX = positionAnim.x._value + x * SHAKE_MULTIPLIER;
      let newY = positionAnim.y._value + y * SHAKE_MULTIPLIER;

      // Apply boundaries within the rectangles
      newX = Math.max(RECT_X, Math.min(RECT_WIDTH - DOT_SIZE, newX));

      if (positionAnim.y._value < height / 2) {
        newY = Math.max(TOP_RECT_Y, Math.min(TOP_RECT_Y + RECT_HEIGHT - DOT_SIZE, newY));
      } else {
        newY = Math.max(BOTTOM_RECT_Y, Math.min(BOTTOM_RECT_Y + RECT_HEIGHT - DOT_SIZE, newY));
      }

      // Apply bounce effect
      bounceEffect(newX, newY);

      // Trigger feedback and sound only if hitting the rectangle edges
      if (isRectHit(newY)) {
        if (!isInRect) {
          triggerFeedback();
          playSound();
          setIsInRect(true);
        }
      } else if (isInRect) {
        setIsInRect(false);
        stopFeedback();
      }

      clearTimeout(moveBackTimeout.current);
      moveBackTimeout.current = setTimeout(() => moveToCenter(), 1000);
    }

    lastAcceleration.current = { x, y, z };
  };

  useEffect(() => {
    const subscription = Accelerometer.addListener(handleShake);
    return () => {
      subscription.remove();
    };
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
    // backgroundColor: 'red',
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
