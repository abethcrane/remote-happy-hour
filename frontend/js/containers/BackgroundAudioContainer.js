import React, { useRef, useEffect } from 'react';

const BACKGROUND_AUDIO = {
  office: '/dev_static/audio/coffee-shop.mp3',
  outside: '/dev_static/audio/yellowstone-robin.mp3',
};

const BackgroundAudioContainer = ({ layout }) => {
  const audioRef = useRef(null);

  useEffect(() => {
    if (audioRef) {
      audioRef.current.volume = 0.2;
      audioRef.current.play();
    }
  });

  return <audio ref={audioRef} src={BACKGROUND_AUDIO[layout]} loop />;
};

export default BackgroundAudioContainer;
