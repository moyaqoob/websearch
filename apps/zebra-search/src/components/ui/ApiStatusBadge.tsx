import { ApiStatus } from '../../types';
import styles from './ApiStatusBadge.module.css';

interface Props {
  status: ApiStatus;
}

const CONFIG: Record<ApiStatus, { label: string }> = {
  live:    { label: 'API live' },
  dead:    { label: 'API offline' },
  loading: { label: 'connecting' },
};

export function ApiStatusBadge({ status }: Props) {
  const { label } = CONFIG[status];
  return (
    <div className={`${styles.badge} ${styles[status]}`}>
      <span className={styles.dot} />
      {label}
    </div>
  );
}
