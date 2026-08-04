import { useNavigate } from 'react-router-dom';

import logo from '../../assets/favicon/wildcats-logo.png';
import styles from './TopNav.module.css';

export const TopNav = () => {
  const navigate = useNavigate();

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
    </nav>
  );
};
