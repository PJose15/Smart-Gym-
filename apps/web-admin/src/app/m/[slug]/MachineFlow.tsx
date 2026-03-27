'use client';

import { useEffect, useRef } from 'react';
import { useScanFlowStore } from '@/lib/stores/scanFlowStore';
import type { MachineData } from '@/lib/stores/scanFlowStore';
import { MachineLanding } from './components/MachineLanding';
import { AuthPhone } from './components/AuthPhone';
import { AuthOTP } from './components/AuthOTP';
import { OnboardGoal } from './components/OnboardGoal';
import { OnboardExperience } from './components/OnboardExperience';
import { WelcomeMoment } from './components/WelcomeMoment';
import { SetLogger } from './components/SetLogger';
import { SessionComplete } from './components/SessionComplete';

interface MachineFlowProps {
  machine: MachineData;
}

export function MachineFlow({ machine }: MachineFlowProps) {
  const { step, setMachine, setScanTimestamp, member, scanEventId, setScanEventId } = useScanFlowStore();
  const scanEventFired = useRef(false);

  useEffect(() => {
    setMachine(machine);
    // Record when the scan page loaded (QR → page)
    setScanTimestamp(Date.now());
  }, [machine, setMachine, setScanTimestamp]);

  // Log scan event when user reaches the logging step (authenticated)
  useEffect(() => {
    if (step === 'logging' && member && !scanEventFired.current) {
      scanEventFired.current = true;
      fetch('/api/scan-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          machine_id: machine.id,
          member_id: member.id,
          gym_id: machine.gym_id,
          workout_mode: 'free',
          was_in_program: false,
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.scan_event_id) {
            setScanEventId(data.scan_event_id);
          }
        })
        .catch(() => {
          // Non-critical analytics — don't block the flow
        });
    }
  }, [step, member, machine, setScanEventId, scanEventId]);

  switch (step) {
    case 'landing':
      return <MachineLanding />;
    case 'auth_phone':
      return <AuthPhone />;
    case 'auth_otp':
      return <AuthOTP />;
    case 'onboard_goal':
      return <OnboardGoal />;
    case 'onboard_experience':
      return <OnboardExperience />;
    case 'welcome':
      return <WelcomeMoment />;
    case 'logging':
      return <SetLogger />;
    case 'complete':
      return <SessionComplete />;
    default:
      return <MachineLanding />;
  }
}
