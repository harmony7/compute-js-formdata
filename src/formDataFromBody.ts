import { getMultipartTypeAndBoundary } from "./utils.js";
import MultipartStreamReader from "./MultipartStreamReader.js";

const decoder = new TextDecoder();

type BodyWithHeaders = Body & {
  headers: Headers,
};

export default async function formDataFromBody(res: BodyWithHeaders): Promise<FormData> {

  const contentType = res.headers.get('Content-Type');
  let multipartType = contentType != null ? getMultipartTypeAndBoundary(contentType) : null;
  if (multipartType == null || multipartType.type !== 'form-data') {
    throw new Error('formDataFromBody cannot be called if Request|Response content type is not multipart/form-data.');
  }
  const { boundary } = multipartType;

  if (res.body == null) {
    throw new Error('formDataFromBody cannot be called if Request|Response has no body.');
  }

  if (res.bodyUsed) {
    throw new Error('formDataFromBody cannot be called if Request|Response body has already been used.');
  }

  const formData = new FormData();

  const multipartStreamReader = new MultipartStreamReader({
    stream: res.body,
    boundary,
    onPart: part => {
      const {
        name,
        contentType,
        filename,
        body,
      } = part;

      if (name == null) {
        throw new Error('Part with no name');
      }
      if (filename != null) {
        const type = contentType ?? 'text/plain';
        const file = new File([body], filename, { type });
        formData.append(name, file, filename);
        return;
      }

      // Try to decode as string
      const value = decoder.decode(body);
      formData.append(name, value);
    }
  });

  await multipartStreamReader.performWork();

  return formData;

}
