import { getSignedFileUrl } from '../../../services/storage';
import styles from './AddTransactionForm.module.css';

// Existing files are stored as private Storage object paths, so "View file"
// mints a short-lived signed URL on demand rather than linking directly.
export const ExistingFileLink = ({ path }: { path: string }) => {
  const handleClick = async () => {
    try {
      const url = await getSignedFileUrl(path);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      // ignore — user can retry the click
    }
  };
  return (
    <button type="button" className={styles['wl-link-button']} onClick={handleClick}>
      View file
    </button>
  );
};
