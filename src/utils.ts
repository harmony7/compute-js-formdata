import { hthvParse as parseHeader } from 'http-header-value';

export type MultipartTypeAndBoundary = {
  type: string,
  boundary: string,
}

export function getMultipartTypeAndBoundary(contentTypeString: string): MultipartTypeAndBoundary | null {

  const [ headerItem ] = parseHeader(contentTypeString.trim());

  if (!headerItem.v.startsWith('multipart/')) {
    return null;
  }

  const boundaryParamItem = headerItem.p['boundary'];
  if (boundaryParamItem == null) {
    return null;
  }
  const boundary = boundaryParamItem.v;
  if (boundary === '') {
    return null;
  }
  const type = headerItem.v.slice('multipart/'.length);

  return { type, boundary };
}
