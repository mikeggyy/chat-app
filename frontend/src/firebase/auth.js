import {
  FacebookAuthProvider,
  GoogleAuthProvider,
  RecaptchaVerifier,
  getAuth,
  signInWithPhoneNumber,
  signInWithPopup,
} from 'firebase/auth';
import { firebaseApp } from './app';

export const auth = getAuth(firebaseApp);
auth.useDeviceLanguage();

const providers = {
  google: new GoogleAuthProvider(),
  facebook: new FacebookAuthProvider(),
};

export function loginWithSocialProvider(providerKey) {
  const provider = providers[providerKey];

  if (!provider) {
    throw new Error(`Unsupported provider: ${providerKey}`);
  }

  return signInWithPopup(auth, provider);
}

export function loginWithPhoneNumber(phoneNumber, verifier) {
  if (!(verifier instanceof RecaptchaVerifier)) {
    throw new Error('A RecaptchaVerifier instance is required for phone login.');
  }

  return signInWithPhoneNumber(auth, phoneNumber, verifier);
}

export function createRecaptchaVerifier(containerId, parameters = {}) {
  return new RecaptchaVerifier(auth, containerId, {
    size: 'invisible',
    ...parameters,
  });
}
