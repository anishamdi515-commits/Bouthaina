import { useState, type FormEvent } from 'react';
import { createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { normalizeEmail, passwordVariants, toLatinDigits } from '../lib/digits';
import { cleanCode, codeEmail, formatCode, isValidCode, newCode } from '../lib/recovery';

function message(code: string): string {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'البريد أو كلمة السر غير صحيحة. تأكدي أنه نفس البريد الذي أُنشئ به الحساب، أو اضغطي «نسيتُ كلمة السر» لاختيار كلمة جديدة.';
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
  const [view, setView] = useState<'start' | 'code' | 'email'>('start');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // One tap: a private account whose recovery code is its only key.
  const start = async () => {
    setError('');
    setBusy(true);
    try {
      const c = newCode();
      await createUserWithEmailAndPassword(auth, codeEmail(c), c);
    } catch (err) {
      setError(message((err as { code?: string }).code ?? ''));
    } finally {
      setBusy(false);
    }
  };

  const restore = async (e: FormEvent) => {
    e.preventDefault();
    const c = cleanCode(code);
    if (!isValidCode(c)) {
      setError('الرمز يتكوّن من 12 حرفاً ورقماً، مثل ' + formatCode('K7QM4XPT9HWN'));
      return;
    }
    setError('');
    setBusy(true);
    try {
      await signInWithEmailAndPassword(auth, codeEmail(c), c);
    } catch (err) {
      const code = (err as { code?: string }).code ?? '';
      setError(code === 'auth/invalid-credential' ? 'هذا الرمز غير صحيح، تحقّقي منه حرفاً حرفاً' : message(code));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <div className="logo">
        <img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="" />
        <h1>بثينة</h1>
        <p>دفتر حصصك، دائماً معك</p>
      </div>

      {view === 'start' && (
        <div className="card">
          {error && <div className="error">{error}</div>}
          <button className="btn block" onClick={start} disabled={busy}>
            {busy ? '…' : 'ابدئي الآن'}
          </button>
          <p className="muted small" style={{ textAlign: 'center', margin: '10px 0 14px' }}>
            بدون كلمة سر ولا بريد. بياناتك تُحفظ في السحابة تلقائياً.
          </p>
          <button className="btn soft block" onClick={() => (setError(''), setView('code'))}>
            هاتف جديد؟ لديّ رمز استرجاع
          </button>
        </div>
      )}

      {view === 'code' && (
        <>
          <form className="card" onSubmit={restore}>
            <h2 style={{ fontSize: 18, marginBottom: 4 }}>استرجاع بياناتك</h2>
            <p className="muted small" style={{ marginTop: 0 }}>
              اكتبي رمز الاسترجاع الذي حفظتِه، وترجع كل حصصك كما كانت.
            </p>
            {error && <div className="error">{error}</div>}
            <input
              className="input code-input"
              dir="ltr"
              autoCapitalize="characters"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              placeholder="XXXX-XXXX-XXXX"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <button className="btn block" style={{ marginTop: 12 }} disabled={busy}>
              {busy ? '…' : 'استرجاع'}
            </button>
          </form>
          <button className="btn ghost block" onClick={() => (setError(''), setView('start'))}>
            رجوع
          </button>
        </>
      )}

      {view === 'email' && <EmailForm onBack={() => setView('start')} />}

      {view === 'start' && (
        <button className="btn ghost block small" onClick={() => setView('email')}>
          الدخول بالبريد الإلكتروني
        </button>
      )}
    </div>
  );
}

function EmailForm({ onBack }: { onBack: () => void }) {
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setBusy(true);
    const mail = normalizeEmail(email);
    try {
      if (mode === 'up') {
        await createUserWithEmailAndPassword(auth, mail, toLatinDigits(password));
      } else {
        // Try the password as typed, then with Latin / Arabic-Indic digits.
        let lastErr: unknown;
        let ok = false;
        for (const p of passwordVariants(password)) {
          try {
            await signInWithEmailAndPassword(auth, mail, p);
            ok = true;
            break;
          } catch (err) {
            lastErr = err;
            if ((err as { code?: string }).code !== 'auth/invalid-credential') break;
          }
        }
        if (!ok) throw lastErr;
      }
    } catch (err) {
      setError(message((err as { code?: string }).code ?? ''));
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    setError('');
    try {
      await sendPasswordResetEmail(auth, normalizeEmail(email));
      setNotice('إذا كان هذا البريد مسجّلاً، ستصلك رسالة فيها رابط لاختيار كلمة سر جديدة. تحقّقي أيضاً من البريد غير المرغوب فيه (Spam).');
    } catch (err) {
      setError(message((err as { code?: string }).code ?? ''));
    }
  };

  return (
    <>
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
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label className="field">
          <span>كلمة السر</span>
          <div className="pw">
            <input
              className="input"
              type={show ? 'text' : 'password'}
              dir="ltr"
              autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
            <button type="button" className="pw-eye" onClick={() => setShow(!show)} aria-label={show ? 'إخفاء كلمة السر' : 'إظهار كلمة السر'}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
                <circle cx="12" cy="12" r="3" />
                {show && <path d="M4 4l16 16" />}
              </svg>
            </button>
          </div>
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
      <button className="btn ghost block" onClick={onBack}>
        رجوع
      </button>
    </>
  );
}
