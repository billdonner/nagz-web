import Axios, { type AxiosRequestConfig } from "axios";

export const AXIOS_INSTANCE = Axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:8000",
});

AXIOS_INSTANCE.interceptors.request.use((config) => {
  const token = localStorage.getItem("nagz_token");
  if (token) {
    config.headers.authorization = `Bearer ${token}`;
  }
  return config;
});

export const customInstance = <T>(config: AxiosRequestConfig): Promise<T> => {
  const source = Axios.CancelToken.source();
  const promise = AXIOS_INSTANCE({
    ...config,
    cancelToken: source.token,
  }).then(({ data }) => data);

  // @ts-expect-error — attach cancel for react-query
  promise.cancel = () => source.cancel("Query was cancelled");

  return promise;
};

export default customInstance;
