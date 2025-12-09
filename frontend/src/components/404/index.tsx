import caravanBrokenImage from '../../assets/caravan-404.svg';
import ErrorComponent from '../common/ErrorPage';

export default function NotFoundComponent() {
  return (
    <ErrorComponent
      graphic={caravanBrokenImage as any}
      title="Whoops! This page doesn't exist"
    />
  );
}
