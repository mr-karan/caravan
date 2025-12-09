import { useNavigate } from 'react-router-dom';
import { getCluster } from '../../../lib/cluster';
import { createRouteURL } from '../../../lib/router/createRouteURL';
import ActionButton from '../../common/ActionButton';

export default function SettingsButton(props: { onClickExtra?: () => void }) {
  const { onClickExtra } = props;
  
  const navigate = useNavigate();
  const clusterName = getCluster();

  if (clusterName === null) {
    return null;
  }

  return (
    <ActionButton
      icon="mdi:cog"
      description="Settings"
      iconButtonProps={{
        color: 'inherit',
      }}
      onClick={() => {
        navigate(createRouteURL('settingsCluster', { cluster: clusterName }));
        onClickExtra && onClickExtra();
      }}
    />
  );
}
