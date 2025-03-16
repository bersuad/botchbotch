import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Dimensions, Vibration, Animated } from 'react-native';
import { Accelerometer } from 'expo-sensors';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';

const { width, height } = Dimensions.get('window'); //To calculate positions relative to the device screen.
const DOT_SIZE = 50;
const SHAKE_THRESHOLD = 1.5;// detacte if it is normal movement or shaken
const SHAKE_MULTIPLIER = 70; // control the dot movement based shake intencity
const SOUND_DELAY = 248.8;// avoid overlaping by making delay between sound plays 
const RECT_HEIGHT = height * 0.35;//defines the height of the dot shaking reange  
const CENTER_POSITION = { x: width / 2 - DOT_SIZE / 2, y: height / 2 - DOT_SIZE / 2 }; //inital position for the dot at center

const RECT_X = 0;
const RECT_WIDTH = width;
const TOP_RECT_Y = height / 2 - RECT_HEIGHT;
const BOTTOM_RECT_Y = height / 2;

export default function App() {
  const positionAnim = useRef(new Animated.ValueXY(CENTER_POSITION)).current;
  const lastAcceleration = useRef({ x: 0, y: 0 });//store acceleration to shaking detection
  const moveBackTimeout = useRef(null);
  const lastSoundTime = useRef(0); //Prevents sound from overlapping by ensuring a delay.
  const lastShakeTime = useRef(Date.now());
  const [isInRect, setIsInRect] = useState(false);//Tracks whether the dot is currently hitting a rectangle corner.

  const playSound = async (file) => {
    const currentTime = Date.now();//take the current second
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
    // provide feedback based on shake speed
    let hapticStyle;
    let vibrationPattern;

    if (speed > 2.5) {
      hapticStyle = Haptics.ImpactFeedbackStyle.Heavy;
      vibrationPattern = [0, 100, 50, 100]; // Stronger, longer vibration
    } else if (speed > 1.8) {
      hapticStyle = Haptics.ImpactFeedbackStyle.Medium;
      vibrationPattern = [0, 70, 40, 70]; // Medium vibration
    } else {
      hapticStyle = Haptics.ImpactFeedbackStyle.Light;
      vibrationPattern = [0, 30]; // Light vibration
    }

    Vibration.vibrate(vibrationPattern);
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
    // detact the user stop shaking and then triger we can trigger function afet that
    const bottomY = BOTTOM_RECT_Y + RECT_HEIGHT - DOT_SIZE;
    bounceToPosition(positionAnim.x._value, bottomY);
  };

  const isRectHit = (y) => {
    // rectangle bounderies
    return (
      (y >= TOP_RECT_Y && y <= TOP_RECT_Y + RECT_HEIGHT - DOT_SIZE) ||
      (y >= BOTTOM_RECT_Y && y <= BOTTOM_RECT_Y + RECT_HEIGHT - DOT_SIZE)
    );
  };

  const handleShake = ({ x, y, z }) => {
    const deltaX = x - lastAcceleration.current.x;
    const deltaY = y - lastAcceleration.current.y;
    const deltaZ = z - lastAcceleration.current.z;
    const speed = Math.sqrt(deltaX ** 2 + deltaY ** 2 + deltaZ ** 2);// Calculates speed using acceleration data.

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
