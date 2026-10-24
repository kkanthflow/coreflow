import React, { useState, useEffect, useRef } from 'react';
import { 
  Video, 
  Mic, 
  Volume2, 
  ShieldCheck, 
  Camera, 
  VideoOff, 
  MicOff, 
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';
import { toast } from '../../components/ui/Toast';
import {
  SettingsSection,
  SettingsRow,
  Toggle,
  Select,
} from '../../components/settings';

export default function AudioVideoSettings() {
  const { userSettings, updateUserSetting } = useSettings();

  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [videoInputs, setVideoInputs] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [loadingDevices, setLoadingDevices] = useState(false);

  // Selected device IDs
  const [selectedAudioInput, setSelectedAudioInput] = useState(userSettings.audioInputId || 'default');
  const [selectedVideoInput, setSelectedVideoInput] = useState(userSettings.videoInputId || 'default');
  const [selectedAudioOutput, setSelectedAudioOutput] = useState(userSettings.audioOutputId || 'default');

  // Live video preview state
  const [cameraPreviewActive, setCameraPreviewActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);

  // Live mic volume test state
  const [micTestActive, setMicTestActive] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0); // 0 to 100
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // 1. Enumerate Hardware Devices
  const enumerateDevices = async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
      toast.error('Media devices API is unavailable in this environment');
      return;
    }

    setLoadingDevices(true);
    try {
      // First check device list
      const devices = await navigator.mediaDevices.enumerateDevices();
      
      const audioIns = devices.filter((d) => d.kind === 'audioinput');
      const videoIns = devices.filter((d) => d.kind === 'videoinput');
      const audioOuts = devices.filter((d) => d.kind === 'audiooutput');

      setAudioInputs(audioIns);
      setVideoInputs(videoIns);
      setAudioOutputs(audioOuts);

      // If device labels are blank, prompt for permissions to read labels
      const hasBlankLabels = devices.some((d) => !d.label && d.kind !== 'audiooutput');
      if (hasBlankLabels && !permissionDenied) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
          stream.getTracks().forEach((track) => track.stop());
          const labeledDevices = await navigator.mediaDevices.enumerateDevices();
          setAudioInputs(labeledDevices.filter((d) => d.kind === 'audioinput'));
          setVideoInputs(labeledDevices.filter((d) => d.kind === 'videoinput'));
          setAudioOutputs(labeledDevices.filter((d) => d.kind === 'audiooutput'));
          setPermissionDenied(false);
        } catch (permErr: any) {
          if (permErr.name === 'NotAllowedError' || permErr.name === 'PermissionDeniedError') {
            setPermissionDenied(true);
          }
        }
      }
    } catch (err: any) {
      console.warn('Device enumeration error:', err);
    } finally {
      setLoadingDevices(false);
    }
  };

  useEffect(() => {
    enumerateDevices();

    navigator.mediaDevices?.addEventListener('devicechange', enumerateDevices);
    return () => {
      navigator.mediaDevices?.removeEventListener('devicechange', enumerateDevices);
      stopCameraPreview();
      stopMicTest();
    };
  }, []);

  // 2. Camera Preview Handler
  const startCameraPreview = async (deviceId: string) => {
    stopCameraPreview();
    try {
      const constraints: MediaStreamConstraints = {
        video: deviceId && deviceId !== 'default' ? { deviceId: { exact: deviceId } } : true,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      videoStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      setCameraPreviewActive(true);
      setPermissionDenied(false);
    } catch (err: any) {
      toast.error('Failed to access camera: ' + err.message);
      setCameraPreviewActive(false);
      if (err.name === 'NotAllowedError') setPermissionDenied(true);
    }
  };

  const stopCameraPreview = () => {
    if (videoStreamRef.current) {
      videoStreamRef.current.getTracks().forEach((t) => t.stop());
      videoStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraPreviewActive(false);
  };

  const toggleCameraPreview = () => {
    if (cameraPreviewActive) {
      stopCameraPreview();
    } else {
      startCameraPreview(selectedVideoInput);
    }
  };

  // 3. Microphone Level Meter
  const startMicTest = async (deviceId: string) => {
    stopMicTest();
    try {
      const constraints: MediaStreamConstraints = {
        audio: deviceId && deviceId !== 'default' ? { deviceId: { exact: deviceId } } : true,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      audioStreamRef.current = stream;

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateMeter = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        const normalized = Math.min(100, Math.round((average / 128) * 100));
        setAudioLevel(normalized);
        animFrameRef.current = requestAnimationFrame(updateMeter);
      };

      updateMeter();
      setMicTestActive(true);
    } catch (err: any) {
      toast.error('Failed to test microphone: ' + err.message);
      setMicTestActive(false);
    }
  };

  const stopMicTest = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((t) => t.stop());
      audioStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setAudioLevel(0);
    setMicTestActive(false);
  };

  const toggleMicTest = () => {
    if (micTestActive) {
      stopMicTest();
    } else {
      startMicTest(selectedAudioInput);
    }
  };

  // Device option formatters
  const audioInputOptions = audioInputs.length
    ? audioInputs.map((d, i) => ({ value: d.deviceId, label: d.label || `Microphone ${i + 1}` }))
    : [{ value: 'default', label: 'Default System Microphone' }];

  const videoInputOptions = videoInputs.length
    ? videoInputs.map((d, i) => ({ value: d.deviceId, label: d.label || `Camera ${i + 1}` }))
    : [{ value: 'default', label: 'Integrated HD Webcam' }];

  const audioOutputOptions = audioOutputs.length
    ? audioOutputs.map((d, i) => ({ value: d.deviceId, label: d.label || `Speaker ${i + 1}` }))
    : [{ value: 'default', label: 'Default System Speaker' }];

  return (
    <div className="space-y-6">
      {/* ── Permission Denied Alert ── */}
      {permissionDenied && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-amber-500">
          <AlertTriangle size={18} className="shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <div className="font-semibold text-text">Camera & Microphone Access Blocked</div>
            <p className="text-muted leading-relaxed">
              Your browser has blocked media device access. Click the lock or camera icon in your address bar and set permissions to "Allow", then refresh.
            </p>
          </div>
        </div>
      )}

      {/* ── Hardware Selection ── */}
      <SettingsSection
        label="Input & Output Devices"
        description="Select connected hardware peripherals for team meetings, live rooms, and recordings."
        action={
          <button
            type="button"
            onClick={enumerateDevices}
            disabled={loadingDevices}
            title="Scan for connected devices"
            className="p-1 text-muted hover:text-text rounded-lg hover:bg-surface-2 transition-colors cursor-pointer"
          >
            <RefreshCw size={13} className={loadingDevices ? 'animate-spin' : ''} />
          </button>
        }
      >
        {/* Camera Select */}
        <SettingsRow
          icon={Video}
          title="Camera Capture Device"
          description="Hardware camera sensor used in LiveKit video rooms."
        >
          <Select
            value={selectedVideoInput}
            onChange={(e) => {
              const val = e.target.value;
              setSelectedVideoInput(val);
              updateUserSetting('videoInputId', val, true);
              if (cameraPreviewActive) startCameraPreview(val);
            }}
            options={videoInputOptions}
            size="sm"
          />
        </SettingsRow>

        {/* Microphone Select */}
        <SettingsRow
          icon={Mic}
          title="Microphone Input Device"
          description="Default audio input channel for voice communication."
        >
          <Select
            value={selectedAudioInput}
            onChange={(e) => {
              const val = e.target.value;
              setSelectedAudioInput(val);
              updateUserSetting('audioInputId', val, true);
              if (micTestActive) startMicTest(val);
            }}
            options={audioInputOptions}
            size="sm"
          />
        </SettingsRow>

        {/* Speaker Select */}
        <SettingsRow
          icon={Volume2}
          title="Audio Output Device"
          description="Target speakers or headphones for conference audio playback."
        >
          <Select
            value={selectedAudioOutput}
            onChange={(e) => {
              const val = e.target.value;
              setSelectedAudioOutput(val);
              updateUserSetting('audioOutputId', val, true);
            }}
            options={audioOutputOptions}
            size="sm"
          />
        </SettingsRow>
      </SettingsSection>

      {/* ── Live Device Diagnostic & Preview Card ── */}
      <SettingsSection
        label="Hardware Diagnostics"
        description="Verify video sensor fidelity and microphone levels before joining meetings."
      >
        <div className="p-4 sm:p-5 space-y-4">
          {/* Camera Preview Area */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-text flex items-center gap-1.5">
                <Camera size={14} className="text-accent" />
                <span>Live Video Feed</span>
              </span>
              <button
                type="button"
                onClick={toggleCameraPreview}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-surface hover:bg-surface-2 text-muted hover:text-text text-[11px] font-mono border border-line transition-colors cursor-pointer"
              >
                {cameraPreviewActive ? <VideoOff size={12} /> : <Video size={12} />}
                <span>{cameraPreviewActive ? 'Stop Preview' : 'Test Camera'}</span>
              </button>
            </div>

            <div className="relative aspect-video max-w-md mx-auto rounded-2xl bg-surface-2 border border-line overflow-hidden flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover transform -scale-x-100 ${
                  cameraPreviewActive ? 'block' : 'hidden'
                }`}
              />
              {!cameraPreviewActive && (
                <div className="flex flex-col items-center justify-center gap-2 text-muted p-6 text-center">
                  <div className="w-10 h-10 rounded-full bg-surface border border-line flex items-center justify-center">
                    <VideoOff size={18} />
                  </div>
                  <span className="text-xs">Camera preview is inactive</span>
                </div>
              )}
            </div>
          </div>

          <div className="h-px bg-line" />

          {/* Microphone Volume Test */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-text flex items-center gap-1.5">
                <Mic size={14} className="text-accent" />
                <span>Microphone Volume Level</span>
              </span>
              <button
                type="button"
                onClick={toggleMicTest}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-surface hover:bg-surface-2 text-muted hover:text-text text-[11px] font-mono border border-line transition-colors cursor-pointer"
              >
                {micTestActive ? <MicOff size={12} /> : <Mic size={12} />}
                <span>{micTestActive ? 'Stop Test' : 'Test Microphone'}</span>
              </button>
            </div>

            <div className="space-y-1.5">
              <div className="h-3 w-full bg-surface-2 rounded-full overflow-hidden border border-line p-0.5">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-75"
                  style={{ width: `${audioLevel}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-mono text-muted">
                <span>0 dB</span>
                <span>{micTestActive ? `${audioLevel}% Level` : 'Click Test to speak'}</span>
                <span>Max Peak</span>
              </div>
            </div>
          </div>
        </div>
      </SettingsSection>

      {/* ── WebRTC Security & Encryption ── */}
      <SettingsSection
        label="Stream Encryption & Cryptography"
        description="Cryptographic protections applied across video rooms and WebRTC peers."
      >
        <SettingsRow
          icon={ShieldCheck}
          title="End-to-End Encryption (E2EE)"
          description="Client-side AES-GCM frame encryption across LiveKit SFU media tracks."
          badge="Enterprise"
        >
          <Toggle
            checked={userSettings.e2eeEnabled ?? true}
            onChange={(checked) => updateUserSetting('e2eeEnabled', checked, true)}
            ariaLabel="Toggle End-to-End Encryption"
          />
        </SettingsRow>
      </SettingsSection>
    </div>
  );
}
