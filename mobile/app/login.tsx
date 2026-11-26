import { useLocalSearchParams, useRouter } from 'expo-router';
import axios from 'axios';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HaatButton, HaatText as Text, MessageState, styles } from '@/components/haat-ui';
import { theme } from '@/constants/theme';
import { api, AccountUser, getApiErrorMessage } from '@/lib/api';
import { clearStoredTokens, setAccessToken, setRefreshToken } from '@/lib/secure-tokens';
import { useSessionStore } from '@/store/session';

type TokenPair = { accessToken: string; refreshToken: string };
type AuthResponse = TokenPair & { mfaRequired?: boolean; mfaToken?: string; message?: string };

export default function LoginScreen() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const exhibitorMode = mode === 'exhibitor';
  const router = useRouter();
  const setUser = useSessionStore((state) => state.setUser);
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [verification, setVerification] = useState<'email' | 'mfa' | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [code, setCode] = useState('');
  const [mfaToken, setMfaToken] = useState('');
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function finishSignIn(tokens: TokenPair) {
    setAccessToken(tokens.accessToken);
    try {
      await setRefreshToken(tokens.refreshToken);
    } catch (error) {
      setAccessToken(null);
      await clearStoredTokens();
      throw error;
    }
    const { data } = await api.get<{ user: AccountUser }>('/auth/me');
    setUser(data.user);
    router.back();
  }

  async function resendVerification() {
    setError('');
    setResending(true);
    try {
      const { data } = await api.post<{ message: string }>('/auth/resend-verification', { email });
      setMessage(data.message);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setResending(false);
    }
  }

  async function submit() {
    setError('');
    setMessage('');
    setBusy(true);
    try {
      if (verification === 'email') {
        const { data } = await api.post<TokenPair>('/auth/mobile/verify-email', { email, code });
        await finishSignIn(data);
        return;
      }
      if (verification === 'mfa') {
        const { data } = await api.post<TokenPair>('/auth/mobile/login/verify', { mfaToken, code });
        await finishSignIn(data);
        return;
      }
      if (creatingAccount) {
        const registrationRoute = exhibitorMode ? '/auth/register-exhibitor' : '/auth/register-visitor';
        const { data } = await api.post<{ message: string }>(registrationRoute, { email, password, fullName });
        setVerification('email');
        setMessage(data.message);
        return;
      }

      const { data } = await api.post<AuthResponse>('/auth/mobile/login', { email, password });
      await finishSignIn(data);
    } catch (requestError) {
      const response = axios.isAxiosError<AuthResponse & { error?: string }>(requestError)
        ? requestError.response
        : undefined;
      if (!creatingAccount && !verification && response?.status === 403 && response.data?.mfaRequired && response.data.mfaToken) {
        setVerification('mfa');
        setMfaToken(response.data.mfaToken);
        setMessage(response.data.message ?? 'Enter the verification code sent to your email.');
      } else {
        setError(response?.data?.error ?? getApiErrorMessage(requestError));
      }
    } finally {
      setBusy(false);
    }
  }

  const needsCode = verification !== null;
  const buttonLabel = busy
    ? 'Please wait…'
    : needsCode
      ? 'Verify and continue'
      : creatingAccount
        ? `Create ${exhibitorMode ? 'exhibitor' : 'visitor'} account`
        : 'Sign in';

  return (
    <SafeAreaView style={styles.page} edges={['bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={[styles.content, { flexGrow: 1 }]} keyboardShouldPersistTaps="handled">
          <View style={{ gap: 10 }}>
            <Text style={styles.eyebrow}>YOUR HAAT OF ART</Text>
            <Text style={{ color: theme.cream, fontFamily: 'HaatDisplay', fontSize: 30 }}>
              {verification ? 'One last step.' : creatingAccount ? `Join as an ${exhibitorMode ? 'exhibitor' : 'art lover'}.` : 'Welcome back.'}
            </Text>
            <Text style={{ color: theme.muted, fontSize: 14, lineHeight: 21 }}>
              {verification
                ? message || 'Enter the six-digit verification code sent to your email.'
                : exhibitorMode
                  ? 'Sign in or create your exhibitor account to submit this application.'
                  : 'Sign in to find your visitor passes and account details.'}
            </Text>
          </View>

          {error ? <MessageState title="We could not continue" description={error} /> : null}
          {message && verification ? (
            <Text style={{ color: theme.success, fontSize: 13, lineHeight: 20 }}>{message}</Text>
          ) : null}

          <View style={{ gap: 9 }}>
            <Text style={styles.label}>Email address</Text>
            <TextInput
              autoCapitalize="none"
              autoComplete="email"
              editable={!needsCode}
              keyboardType="email-address"
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={theme.subtle}
              style={[styles.field, needsCode ? { opacity: 0.6 } : null]}
              value={email}
            />
          </View>

          {!needsCode ? (
            <>
              {creatingAccount ? (
                <View style={{ gap: 9 }}>
                  <Text style={styles.label}>Full name</Text>
                  <TextInput
                    autoCapitalize="words"
                    autoComplete="name"
                    onChangeText={setFullName}
                    placeholder="Your name"
                    placeholderTextColor={theme.subtle}
                    style={styles.field}
                    value={fullName}
                  />
                </View>
              ) : null}
              <View style={{ gap: 9 }}>
                <Text style={styles.label}>Password</Text>
                <TextInput
                  autoCapitalize="none"
                  autoComplete={creatingAccount ? 'new-password' : 'password'}
                  onChangeText={setPassword}
                  placeholder={creatingAccount ? 'At least 12 characters' : 'Your password'}
                  placeholderTextColor={theme.subtle}
                  secureTextEntry
                  style={styles.field}
                  value={password}
                />
              </View>
            </>
          ) : (
            <View style={{ gap: 9 }}>
              <Text style={styles.label}>Six-digit code</Text>
              <TextInput
                autoComplete="one-time-code"
                keyboardType="number-pad"
                maxLength={6}
                onChangeText={setCode}
                placeholder="000000"
                placeholderTextColor={theme.subtle}
                style={styles.field}
                value={code}
              />
            </View>
          )}

          <HaatButton label={buttonLabel} onPress={() => void submit()} disabled={busy || (needsCode && code.length !== 6)} />
          {!needsCode ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setCreatingAccount((current) => !current);
                setError('');
                setMessage('');
              }}>
              <Text style={{ color: theme.terracottaLight, fontSize: 13, textAlign: 'center' }}>
                {creatingAccount ? 'Already have an account? Sign in' : 'New to the Haat? Create an account'}
              </Text>
            </Pressable>
          ) : (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setVerification(null);
                setCode('');
                setMessage('');
                setError('');
              }}>
              <Text style={{ color: theme.terracottaLight, fontSize: 13, textAlign: 'center' }}>Back to sign in</Text>
            </Pressable>
          )}
          {verification === 'email' ? (
            <Pressable
              accessibilityRole="button"
              disabled={resending}
              onPress={() => void resendVerification()}>
              <Text style={{ color: theme.terracottaLight, fontSize: 12, opacity: resending ? 0.6 : 1, textAlign: 'center' }}>
                {resending ? 'Sending another code…' : 'Resend verification code'}
              </Text>
            </Pressable>
          ) : null}
          <Text style={{ color: theme.subtle, fontSize: 11, lineHeight: 17, textAlign: 'center' }}>
            Your account uses The Haat of Art’s existing website authentication and visitor records.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
