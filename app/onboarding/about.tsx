import { Redirect } from 'expo-router';

/** The old second page now lives on the welcome screen. */
export default function About() {
  return <Redirect href="/onboarding/welcome" />;
}
