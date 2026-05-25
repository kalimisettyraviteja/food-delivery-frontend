import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem('token');

  const publicUrls = [
    'http://localhost:8080/api/users/login',
    'http://localhost:8080/api/users/register'
  ];

  const isPublicRequest = publicUrls.some(url => req.url.includes(url));

  if (token && !isPublicRequest) {
    const authReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
    return next(authReq);
  }
  

  return next(req);
};