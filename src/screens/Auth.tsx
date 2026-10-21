import { useState, type FormEvent } from 'react';
import { createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';

function message(code: string): string {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'البريد أو كلمة السر غير صحيحة';
    case 'auth/email-already-in-use':
      return 'هذا البريد لديه حساب، اختاري «دخول»';
    case 'auth/weak-password':
      return 'كلمة السر قصيرة، 6 أحرف على الأقل';
    case 'auth/invalid-email':
      return 'البريد الإلكتروني غير صحيح';
    case 'auth/network-request-failed':
      return 'لا يوجد اتصال بالإنترنت';
    case 'auth/too-many-requests':
      return 'محاولات كثيرة، انتظري قليلاً ثم أعيدي';
    case 'auth/missing-email':
      return 'اكتبي بريدك الإلكتروني أولاً';
    default:
      return 'حدث خطأ، حاولي مرة أخرى';
  }
}

export function AuthScreen() {
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setBusy(true);
    try {
      if (mode === 'in') await signInWithEmailAndPassword(auth, email.trim(), password);
      else await createUserWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      setError(message((err as { code?: string }).code ?? ''));
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    setError('');
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setNotice('أرسلنا رابط إعادة تعيين كلمة السر إلى بريدك 💌');
    } catch (err) {
      setError(message((err as { code?: string }).code ?? ''));
    }
  };

  return (
    <div className="auth">
      <div className="logo">
        <span className="flower">🌸</span>
        <h1>بثينة</h1>
        <p>دفتر حصصك، دائماً معك</p>
      </div>
      <form className="card" onSubmit={submit}>
        <div className="tabs" style={{ justifyContent: 'center' }}>
          <button type="button" className={'tab' + (mode === 'in' ? ' on' : '')} onClick={() => setMode('in')}>
            دخول
          </button>
          <button type="button" className={'tab' + (mode === 'up' ? ' on' : '')} onClick={() => setMode('up')}>
            حساب جديد
          </button>
        </div>
        {error && <div className="error">{error}</div>}
        {notice && <div className="notice">{notice}</div>}
        <label className="field">
          <span>البريد الإلكتروني</span>
          <input
            className="input"
            type="email"
            dir="ltr"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label className="field">
          <span>كلمة السر</span>
          <input
            className="input"
            type="password"
            dir="ltr"
            autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
        </label>
        <button className="btn block" disabled={busy}>
          {busy ? '…' : mode === 'in' ? 'دخول' : 'إنشاء الحساب'}
        </button>
        {mode === 'in' && (
          <button type="button" className="btn ghost block" style={{ marginTop: 6 }} onClick={reset}>
            نسيتُ كلمة السر
          </button>
        )}
      </form>
      <p className="muted small" style={{ textAlign: 'center' }}>
        بياناتك محفوظة في حسابك، حتى لو غيّرتِ الهاتف
      </p>
    </div>
  );
}
