import { initializeApp } from 'firebase/app';
import {
  ConfirmationResult,
  getAuth,
  GoogleAuthProvider,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getFirestore,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { Currency } from './utils/transferMath';
import {
  PayerRole,
  PaymentGateway,
  PaymentMethod,
  PaymentRegion,
  PaymentStatus,
  SavedPaymentMethod,
  TransferHistoryEntry,
  TransferLifecycleStatus,
} from './utils/transferHistory';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    phoneNumber?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      phoneNumber: auth.currentUser?.phoneNumber,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

void testConnection();

export function formatFirebaseAuthError(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code || '')
      : '';
  const msg = error instanceof Error ? error.message : String(error);

  if (code === 'auth/operation-not-allowed' || msg.includes('operation-not-allowed')) {
    return 'Phone OTP sign-in is not enabled yet in your Firebase project. Enable Authentication -> Sign-in method -> Phone in the Firebase Console (and add this domain under Authorized domains), or use Google Sign-In.';
  }
  if (code === 'auth/invalid-phone-number') {
    return 'Enter a valid phone number in international format (for example +919876543210).';
  }
  if (code === 'auth/invalid-verification-code') {
    return 'That 6-digit OTP code is incorrect. Check the SMS code and try again.';
  }
  if (code === 'auth/code-expired') {
    return 'The OTP code has expired. Request a fresh OTP code to continue.';
  }
  if (code === 'auth/too-many-requests') {
    return 'Too many OTP requests right now. Wait a moment or sign in with Google ID.';
  }
  if (code === 'auth/popup-closed-by-user') {
    return 'Google Sign-In popup was closed before finishing.';
  }
  if (code === 'auth/unauthorized-domain') {
    return 'Add this app domain to Firebase Console -> Authentication -> Settings -> Authorized domains.';
  }
  return msg;
}

export async function signInWithGoogle() {
  return signInWithPopup(auth, googleProvider);
}

export function createPhoneRecaptcha(containerElement: HTMLElement): RecaptchaVerifier {
  return new RecaptchaVerifier(auth, containerElement, {
    size: 'invisible',
  });
}

export async function sendPhoneOtp(
  phoneE164: string,
  recaptcha: RecaptchaVerifier
): Promise<ConfirmationResult> {
  return signInWithPhoneNumber(auth, phoneE164, recaptcha);
}

export async function signOutUser() {
  return signOut(auth);
}

export async function ensureUserProfile(
  user: User,
  preferredCurrency: Currency
): Promise<void> {
  const userPath = `users/${user.uid}`;
  const ref = doc(db, 'users', user.uid);
  const email = user.email ? user.email.slice(0, 320) : undefined;
  const phoneNumber = user.phoneNumber ? user.phoneNumber.slice(0, 32) : undefined;
  const fallbackName = email ? email.split('@')[0] : phoneNumber || 'App User';
  const displayName = (user.displayName || fallbackName).slice(0, 120);
  const photoURL = user.photoURL ? user.photoURL.slice(0, 500) : undefined;

  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      const payload: Record<string, unknown> = {
        uid: user.uid,
        displayName,
        preferredCurrency,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (email) payload.email = email;
      if (phoneNumber) payload.phoneNumber = phoneNumber;
      if (photoURL) payload.photoURL = photoURL;
      await setDoc(ref, payload);
    } else {
      const updatePayload: Record<string, unknown> = {
        displayName,
        preferredCurrency,
        updatedAt: serverTimestamp(),
      };
      if (email) updatePayload.email = email;
      if (phoneNumber) updatePayload.phoneNumber = phoneNumber;
      if (photoURL) updatePayload.photoURL = photoURL;
      await updateDoc(ref, updatePayload);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }
}

export interface SaveTransferHistoryInput {
  code: string;
  headline: string;
  fileCount: number;
  totalBytes: number;
  billedGb: number;
  mode: 'p2p' | 'server';
  destination: string;
  currency: Currency;
  priceAmount: number;
  priceFormatted: string;
  paymentGateway: PaymentGateway;
  paymentMethod: PaymentMethod;
  payerRole: PayerRole;
  paymentStatus: PaymentStatus;
  status: TransferLifecycleStatus;
  shareUrl: string;
}

export async function saveTransferToHistory(
  ownerUid: string,
  input: SaveTransferHistoryInput
): Promise<void> {
  const path = `users/${ownerUid}/transfers/${input.code}`;
  const ref = doc(db, 'users', ownerUid, 'transfers', input.code);
  try {
    await setDoc(ref, {
      code: input.code.slice(0, 32),
      ownerUid,
      headline: input.headline.slice(0, 180) || input.code,
      fileCount: Math.max(1, Math.min(100000, Math.round(input.fileCount))),
      totalBytes: Math.max(0, Number(input.totalBytes) || 0),
      billedGb: Math.max(1, Math.min(25000, Math.round(input.billedGb))),
      mode: input.mode,
      destination: input.destination.slice(0, 180) || 'Direct P2P',
      currency: input.currency,
      priceAmount: Math.max(0, Number(input.priceAmount) || 0),
      priceFormatted: input.priceFormatted.slice(0, 32),
      paymentGateway: input.paymentGateway,
      paymentMethod: input.paymentMethod,
      payerRole: input.payerRole,
      paymentStatus: input.paymentStatus,
      status: input.status,
      shareUrl: input.shareUrl.slice(0, 240),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateTransferHistoryStatus(
  ownerUid: string,
  code: string,
  status: TransferLifecycleStatus
): Promise<void> {
  const path = `users/${ownerUid}/transfers/${code}`;
  const ref = doc(db, 'users', ownerUid, 'transfers', code);
  try {
    await updateDoc(ref, {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteTransferHistoryRecord(
  ownerUid: string,
  code: string
): Promise<void> {
  const path = `users/${ownerUid}/transfers/${code}`;
  const ref = doc(db, 'users', ownerUid, 'transfers', code);
  try {
    await deleteDoc(ref);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeToTransferHistory(
  ownerUid: string,
  onData: (entries: TransferHistoryEntry[]) => void,
  onError: (err: Error) => void
): () => void {
  const colPath = `users/${ownerUid}/transfers`;
  const q = query(
    collection(db, 'users', ownerUid, 'transfers'),
    where('ownerUid', '==', ownerUid)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const items: TransferHistoryEntry[] = snapshot.docs.map((d) => {
        const raw = d.data();
        const createdTs = raw.createdAt instanceof Timestamp ? raw.createdAt.toMillis() : Date.now();
        const rawMethod = String(raw.paymentMethod || 'card');
        const method: PaymentMethod =
          rawMethod === 'upi' ||
          rawMethod === 'netbanking' ||
          rawMethod === 'wallet' ||
          rawMethod === 'card'
            ? rawMethod
            : 'card';
        return {
          code: String(raw.code || d.id),
          ownerUid: String(raw.ownerUid || ownerUid),
          headline: String(raw.headline || d.id),
          fileCount: Number(raw.fileCount || 1),
          totalBytes: Number(raw.totalBytes || 0),
          billedGb: Number(raw.billedGb || 1),
          mode: raw.mode === 'server' ? 'server' : 'p2p',
          destination: String(raw.destination || 'Direct P2P'),
          currency: raw.currency === 'INR' ? 'INR' : 'USD',
          priceAmount: Number(raw.priceAmount || 0),
          priceFormatted: String(raw.priceFormatted || '$0.50'),
          paymentGateway: raw.paymentGateway === 'razorpay' ? 'razorpay' : 'stripe',
          paymentMethod: method,
          payerRole: raw.payerRole === 'receiver' ? 'receiver' : 'sender',
          paymentStatus: raw.paymentStatus === 'pending_receiver' ? 'pending_receiver' : 'paid',
          status: (raw.status as TransferLifecycleStatus) || 'ready',
          shareUrl: String(raw.shareUrl || `${window.location.origin}/?t=${d.id}`),
          createdAtMs: createdTs,
        };
      });
      items.sort((a, b) => b.createdAtMs - a.createdAtMs);
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, colPath);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export interface AddPaymentMethodInput {
  label: string;
  region: PaymentRegion;
  gateway: PaymentGateway;
  method: PaymentMethod;
  detail: string;
  isDefault: boolean;
}

export async function addSavedPaymentMethod(
  ownerUid: string,
  input: AddPaymentMethodInput,
  existingMethods: SavedPaymentMethod[]
): Promise<void> {
  const id = `pm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const path = `users/${ownerUid}/paymentMethods/${id}`;
  const ref = doc(db, 'users', ownerUid, 'paymentMethods', id);
  const shouldBeDefault = input.isDefault || existingMethods.length === 0;

  try {
    const batch = writeBatch(db);
    if (shouldBeDefault) {
      for (const m of existingMethods) {
        if (m.isDefault) {
          batch.update(doc(db, 'users', ownerUid, 'paymentMethods', m.id), {
            isDefault: false,
            updatedAt: serverTimestamp(),
          });
        }
      }
    }
    batch.set(ref, {
      id,
      ownerUid,
      label: input.label.slice(0, 60),
      region: input.region,
      gateway: input.gateway,
      method: input.method,
      detail: input.detail.slice(0, 120),
      isDefault: shouldBeDefault,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function setDefaultPaymentMethod(
  ownerUid: string,
  targetId: string,
  existingMethods: SavedPaymentMethod[]
): Promise<void> {
  const path = `users/${ownerUid}/paymentMethods/${targetId}`;
  try {
    const batch = writeBatch(db);
    for (const m of existingMethods) {
      const nextDefault = m.id === targetId;
      if (m.isDefault !== nextDefault) {
        batch.update(doc(db, 'users', ownerUid, 'paymentMethods', m.id), {
          isDefault: nextDefault,
          updatedAt: serverTimestamp(),
        });
      }
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteSavedPaymentMethod(
  ownerUid: string,
  methodId: string
): Promise<void> {
  const path = `users/${ownerUid}/paymentMethods/${methodId}`;
  try {
    await deleteDoc(doc(db, 'users', ownerUid, 'paymentMethods', methodId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeToPaymentMethods(
  ownerUid: string,
  onData: (methods: SavedPaymentMethod[]) => void,
  onError: (err: Error) => void
): () => void {
  const colPath = `users/${ownerUid}/paymentMethods`;
  const q = query(
    collection(db, 'users', ownerUid, 'paymentMethods'),
    where('ownerUid', '==', ownerUid)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const items: SavedPaymentMethod[] = snapshot.docs.map((d) => {
        const raw = d.data();
        const createdTs = raw.createdAt instanceof Timestamp ? raw.createdAt.toMillis() : Date.now();
        const rawMethod = String(raw.method || 'card');
        const method: PaymentMethod =
          rawMethod === 'upi' ||
          rawMethod === 'netbanking' ||
          rawMethod === 'wallet' ||
          rawMethod === 'card'
            ? rawMethod
            : 'card';
        return {
          id: String(raw.id || d.id),
          ownerUid: String(raw.ownerUid || ownerUid),
          label: String(raw.label || 'Payment Method'),
          region: raw.region === 'IN' ? 'IN' : 'GLOBAL',
          gateway: raw.gateway === 'razorpay' ? 'razorpay' : 'stripe',
          method,
          detail: String(raw.detail || ''),
          isDefault: Boolean(raw.isDefault),
          createdAtMs: createdTs,
        };
      });
      items.sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || b.createdAtMs - a.createdAtMs);
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, colPath);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}
