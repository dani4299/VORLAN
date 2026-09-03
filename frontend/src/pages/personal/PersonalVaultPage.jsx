import React, { useState, useEffect } from 'react';
import { Lock, AlertCircle, X } from 'lucide-react';
import api, { getUsername } from '../../lib/api';
import { GlassPanel } from '../../components/ui/GlassPanel';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { BackButton } from '../../components/ui/BackButton';
import { FileManager } from '../files/FileManager';

const PinDots = ({ length }) => (
  <div className="flex gap-4 mb-10">
    {[...Array(6)].map((_, i) => (
      <div
        key={i}
        className="w-3.5 h-3.5 rounded-full border-2 transition-all duration-200"
        style={{
          background: length > i ? 'var(--ink)' : 'transparent',
          borderColor: length > i ? 'var(--ink)' : 'rgba(255,255,255,0.2)',
          transform: length > i ? 'scale(1.1)' : 'scale(1)',
          boxShadow: length > i ? '0 0 12px rgba(255,255,255,0.5)' : 'none',
        }}
      />
    ))}
  </div>
);

export const PersonalVaultPage = () => {
  const activeUser = getUsername();
  const [hasPin, setHasPin] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [setupStep, setSetupStep] = useState(0);
  const [firstPin, setFirstPin] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/personal/has-pin/${activeUser}`)
      .then(res => setHasPin(res.data.hasPin))
      .catch(err => console.error("Couldn't check your private space", err))
      .finally(() => setLoading(false));
  }, [activeUser]);

  const handlePinPress = (num) => {
    if (pin.length >= 6) return;
    const newPin = pin + num;
    setPin(newPin);
    setError('');
    if (newPin.length !== 6) return;

    if (!hasPin) {
      if (setupStep === 1) {
        setFirstPin(newPin);
        setTimeout(() => { setPin(''); setSetupStep(2); }, 300);
      } else if (setupStep === 2) {
        if (newPin === firstPin) {
          verifyOrSetPin(newPin);
        } else {
          setError("Those PINs don't match");
          setTimeout(() => { setPin(''); setFirstPin(''); setSetupStep(1); }, 1500);
        }
      }
    } else {
      verifyOrSetPin(newPin);
    }
  };

  const verifyOrSetPin = async (completedPin) => {
    try {
      const res = await api.post('/personal/pin', { username: activeUser, pin: completedPin });
      if (res.data.success) setIsUnlocked(true);
    } catch (err) {
      setError('Incorrect PIN');
      setTimeout(() => setPin(''), 1000);
    }
  };

  if (loading) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <Spinner className="w-10 h-10" />
      </div>
    );
  }

  if (!isUnlocked && !hasPin && setupStep === 0) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center p-6 overflow-y-auto">
        <BackButton className="absolute top-4 left-4 md:top-6 md:left-6" />
        <GlassPanel strong className="flex flex-col items-center max-w-lg w-full py-10 text-center p-8 md:p-12">
          <div className="w-16 h-16 rounded-[22px] flex items-center justify-center mb-6" style={{ background: 'linear-gradient(145deg, #ffcf8a, var(--hue-amber))' }}>
            <Lock size={30} className="text-white" />
          </div>
          <h2 className="text-2xl md:text-3xl font-semibold text-[var(--ink)] tracking-tight mb-4">Set up your private space</h2>
          <p className="text-sm md:text-base text-[var(--ink-muted)] mb-8 leading-relaxed">Files and notes you keep here are private to you. Set a 6-digit PIN to keep them protected.</p>
          <div className="p-5 rounded-2xl mb-8 w-full text-left" style={{ background: 'rgba(255,180,84,0.1)', border: '1px solid rgba(255,180,84,0.25)' }}>
            <h3 className="font-semibold text-xs flex items-center gap-2 mb-2" style={{ color: 'var(--hue-amber)' }}><AlertCircle size={15} /> Please remember your PIN</h3>
            <p className="text-xs md:text-sm leading-relaxed" style={{ color: 'rgba(255,215,170,0.75)' }}>Not even an administrator can unlock your private space without it. If you forget your PIN, these files can't be recovered.</p>
          </div>
          <Button variant="primary" size="lg" onClick={() => setSetupStep(1)} className="w-full">Continue</Button>
        </GlassPanel>
      </div>
    );
  }

  if (!isUnlocked) {
    let padTitle = 'Enter your PIN';
    let padSubtitle = 'Enter your 6-digit PIN to unlock your private space.';
    if (!hasPin) {
      padTitle = setupStep === 1 ? 'Create a PIN' : 'Confirm your PIN';
      padSubtitle = setupStep === 1 ? 'Choose a 6-digit PIN.' : 'Enter it once more to confirm.';
    }

    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center p-6 overflow-y-auto">
        <BackButton className="absolute top-4 left-4 md:top-6 md:left-6" />
        <div className="flex flex-col items-center max-w-sm w-full py-10">
          <div className="w-14 h-14 rounded-[20px] flex items-center justify-center mb-6" style={{ background: 'linear-gradient(145deg, #ffcf8a, var(--hue-amber))' }}>
            <Lock size={24} className="text-white" />
          </div>
          <h2 className="text-xl font-semibold text-[var(--ink)] tracking-tight mb-2">{padTitle}</h2>
          <p className="text-sm text-[var(--ink-muted)] mb-9 text-center px-4">{padSubtitle}</p>
          <PinDots length={pin.length} />
          <div className="h-6 mb-6 flex items-center justify-center">
            {error && <p className="text-sm font-medium" style={{ color: 'var(--hue-rose)' }}>{error}</p>}
          </div>
          <div className="grid grid-cols-3 gap-x-7 gap-y-5">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
              <button
                key={num}
                onClick={() => handlePinPress(num.toString())}
                className="glass w-16 h-16 rounded-full text-2xl font-medium text-[var(--ink)] active:scale-90 transition-transform"
              >
                {num}
              </button>
            ))}
            <div />
            <button onClick={() => handlePinPress('0')} className="glass w-16 h-16 rounded-full text-2xl font-medium text-[var(--ink)] active:scale-90 transition-transform">0</button>
            <button onClick={() => setPin(pin.slice(0, -1))} className="w-16 h-16 rounded-full flex items-center justify-center text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors">
              <X size={24} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 p-4 md:p-10 overflow-y-auto animate-sheet-in">
      <div className="max-w-6xl mx-auto">
        <BackButton className="mb-4" />
        <FileManager isPersonal={true} />
      </div>
    </div>
  );
};
