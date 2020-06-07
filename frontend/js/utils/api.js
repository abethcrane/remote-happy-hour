import axios from 'axios';

const requestWrapper = (promise) =>
  promise
    .then((res) => res.data)
    .catch(({ response }) => {
      return Promise.reject({
        ...response.data,
        status: response.status,
      });
    });

const get = (route, params) => requestWrapper(axios.get(route, { params }));

const post = (route, jsonData) => requestWrapper(axios.post(route, jsonData));

const postForm = (route, data) => {
  const formData = new FormData();
  Object.keys(data).forEach((key) => formData.set(key, data[key]));
  return post(route, formData);
};

export default {
  get,
  post,
  postForm,
};
