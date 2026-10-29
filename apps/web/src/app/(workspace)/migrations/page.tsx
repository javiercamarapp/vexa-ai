import {SoloInterno} from '../../../components/workspace/access';
import {MigrationWorkspace} from '../../../components/migration-aliases';
import {metaTitulo} from '../../../lib/i18n/titulo';
export const generateMetadata=()=>metaTitulo('meta.titulo.migrations');
export default function MigrationPage(){return <SoloInterno><MigrationWorkspace/></SoloInterno>;}
