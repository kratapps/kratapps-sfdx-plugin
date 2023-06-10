import { Dictionary } from '@salesforce/ts-types';
import { Optional } from '@salesforce/ts-types/lib/types/union';

import infos from '../metadata/metadataTypeInfos';

type TypeDef = {
    metadataName: string; // ApexClass
    defaultDirectory: string; // classes
    parent?: TypeDef;
};

const typeDefs: Dictionary<TypeDef> = infos.typeDefs;

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
