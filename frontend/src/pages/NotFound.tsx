import { Link } from 'react-router-dom';
import { Status } from '../components/ui';

export default function NotFound() {
  return (
    <Status
      icon="sentiment_dissatisfied"
      title="This page isn't available"
      message="The link may be broken or the page may have been removed."
      action={
        <Link to="/" className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black">
          Go home
        </Link>
      }
    />
  );
}
