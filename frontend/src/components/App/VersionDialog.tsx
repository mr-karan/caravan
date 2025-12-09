import DialogContent from '@mui/material/DialogContent';
import { useDispatch } from 'react-redux';
import { getProductName, getVersion } from '../../helpers/getProductInfo';
import { useTypedSelector } from '../../redux/hooks';
import { uiSlice } from '../../redux/uiSlice';
import { Dialog } from '../common/Dialog';
import NameValueTable from '../common/NameValueTable';

export default function VersionDialog(props: {
  getVersion?: () => {
    VERSION: any;
    GIT_VERSION: any;
  };
}) {
  const open = useTypedSelector(state => state.ui.isVersionDialogOpen);
  const dispatch = useDispatch();
  
  const { VERSION, GIT_VERSION } = props.getVersion ? props.getVersion() : getVersion();

  return (
    <Dialog
      maxWidth="sm"
      open={open}
      onClose={() => dispatch(uiSlice.actions.setVersionDialogOpen(false))}
      title={getProductName()}
      // We want the dialog to show on top of the cluster chooser one if needed
      style={{ zIndex: 1900 }}
    >
      <DialogContent>
        <NameValueTable
          rows={[
            {
              name: 'Version',
              value: VERSION,
            },
            {
              name: 'Git Commit',
              value: GIT_VERSION,
            },
          ]}
        />
      </DialogContent>
    </Dialog>
  );
}
