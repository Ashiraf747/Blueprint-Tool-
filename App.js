import React, { useState, useMemo, useEffect } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView,
  Switch, Share, Alert, Platform, StatusBar, useWindowDimensions,
} from 'react-native';
import Svg, { Rect, Line, Text as SvgText, G, Polygon, Circle } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';

/* ------------------------------------------------------------------ */
/*  Design tokens                                                      */
/* ------------------------------------------------------------------ */
const C = {
  bg: '#E8EDEE', surface: '#F7F9F9', ink: '#12262B', sub: '#506168',
  line: '#B4C3C7', primary: '#0F5C6E', stake: '#E0A800',
  warn: '#8A5200', warnBg: '#FBF0D4', ok: '#2F6B3F', okBg: '#DDEBDD',
  info: '#0F5C6E', infoBg: '#D8E8EC',
  zone: { public: '#DCE9ED', service: '#E4EBD8', private: '#EADFD2', passage: '#F7F9F9' },
  wingM: '#CFE0F2', wingF: '#F0D9E0',
};
const SERIF = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, serif' });

// Alert.alert does nothing on the web, so use the browser's own dialog there.
const notify = (title, msg) => {
  if (Platform.OS === 'web') window.alert(title + '\n' + msg);
  else Alert.alert(title, msg);
};

/* ------------------------------------------------------------------ */
