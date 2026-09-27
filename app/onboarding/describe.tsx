import React, { useState } from 'react';
import { Text } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Button, ScreenWithFooter } from '../../src/components/ui';
import { Stepper } from '../../src/components/Stepper';
import { OnboardingBackButton, OnboardingContent } from '../../src/components/OnboardingMotion';
import { VoiceInput } from '../../src/components/VoiceInput';
import { useApp } from '../../src/store/AppStore';
import { spacing, type } from '../../src/theme';

/**
 * Steps one and two of onboarding: motor and vocal tic descriptions.
 * Motor first, then vocal — the two halves the design keeps separate because
 * they need different prompting to get a useful answer.
 */
export default function Describe() {
  const router = useRouter();
  const { data, update } = useApp();
  const [step, setStep] = useState<0 | 1>(0);
  const [motor, setMotor] = useState(data.motorNarrative);
  const [vocal, setVocal] = useState(data.vocalNarrative);

  const isMotor = step === 0;
  const text = isMotor ? motor : vocal;
  const setText = isMotor ? setMotor : setVocal;

  const proceedToRatings = (vocalDescription: string) => {
    update((draft) => {
      draft.motorNarrative = motor;
      draft.vocalNarrative = vocalDescription;
    });
    router.push('/onboarding/rate');
  };

  const next = () => {
    if (isMotor) setStep(1);
    else proceedToRatings(vocal);
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerLeft: () => (
            <OnboardingBackButton
              onPress={() => {
                if (!isMotor) {
                  setStep(0);
                  return;
                }
                update((draft) => {
                  draft.motorNarrative = motor;
                  draft.vocalNarrative = vocal;
                });
                if (router.canGoBack()) router.back();
                else router.replace('/onboarding/welcome');
              }}
            />
          ),
        }}
      />
      <ScreenWithFooter
        footer={
          <>
            <Button
              title="Continue"
              onPress={next}
              disabled={isMotor && motor.trim().length === 0}
            />
            {isMotor ? (
              <Button
                title="I do not have motor tics"
                variant="ghost"
                onPress={() => {
                  setMotor('');
                  setStep(1);
                }}
              />
            ) : (
              <Button
                title="I do not have vocal tics"
                variant="ghost"
                onPress={() => {
                  setVocal('');
                  proceedToRatings('');
                }}
              />
            )}
          </>
        }
      >
        <Stepper total={5} current={step + 1} />
        <OnboardingContent key={step}>
          <Text style={type.h2}>
            {isMotor ? 'Describe your motor tics' : 'Now your vocal tics'}
          </Text>
          <Text style={type.muted}>
            {isMotor
              ? 'Movements you make: blinking, head jerks, shrugging, anything your body does on its own. Say it the way you would tell a friend. Nothing needs to be medical.'
              : 'Sounds you make: throat clearing, sniffing, coughing, humming, words.'}
          </Text>

          <VoiceInput
            value={text}
            onChange={setText}
            placeholder={
              isMotor
                ? 'e.g. I blink really hard a lot, and sometimes my head snaps to the left…'
                : 'e.g. I clear my throat over and over, especially when I am tired…'
            }
            minHeight={170}
          />

        </OnboardingContent>
      </ScreenWithFooter>
    </>
  );
}
