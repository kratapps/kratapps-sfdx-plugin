import infos from '../metadata/metadataTypeInfos';
import { Optional } from '@salesforce/ts-types/lib/types/union';

const typeDefs: any = infos.typeDefs;

export type MetadataTypeInfo = {
    metadataName: string; // ApexClass
    directoryName: string; // classes
    parent?: MetadataTypeInfo;
};

export function getTypeInfo(metadataName: string): Optional<MetadataTypeInfo> {
    const info = typeDefs[metadataName];
    if (!info) {
        return undefined;
    }
    const result: MetadataTypeInfo = {
        metadataName: info.metadataName,
        directoryName: info.defaultDirectory,
        parent: undefined
    };
    if (info?.parent) {
        result.parent = {
            metadataName: info.parent.metadataName,
            directoryName: info.parent.defaultDirectory
        };
    }
    return result;
}
