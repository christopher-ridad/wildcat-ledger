import { useNavigate } from 'react-router-dom';

import logo from '../../assets/favicon/wildcats-logo.png';
import { useAuth } from '../../features/authentication/hooks/useAuth';
import styles from './TopNav.module.css';

export const TopNav = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  return (
    <nav className={styles['wl-topnav']}>
      <button
        type="button"
        className={styles['wl-topnav-logo']}
        onClick={() => navigate('/organizations')}
        aria-label="Go to home"
      >
        <img src={logo} alt="WildcatLedger" className={styles['wl-topnav-logo-img']} />
        <span className={styles['wl-topnav-logo-text']}>WildcatLedger</span>
      </button>
      <div className={styles['wl-topnav-actions']}>
        <button
          type="button"
          className={styles['wl-topnav-faq']}
          onClick={() => navigate('/faq')}
        >
          FAQ
        </button>
        <button type="button" className={styles['wl-topnav-signout']} onClick={signOut}>
          Sign Out
        </button>
      </div>
    </nav>
  );
};
