//로그인이 토큰을 검사하고, 사장님 토큰인지 확인
import { prisma } from '../utils/prisma/index.js';
import jwt from 'jsonwebtoken';
const userauthmiddle = (requiredType) => {
  return async function (req, res, next) {
    try {
      const { authorization } = req.cookies;
      if (!authorization) {
        throw new Error('로그인이 필요한 서비스 입니다.');
      }
      const [tokenType, token] = authorization.split(' ');
      if (tokenType !== 'Bearer') {
        throw new Error('토큰 타입이 일치하지 않습니다.');
      }
      const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
      const { nickname } = decodedToken;
      const user = await prisma.users.findFirst({
        where: {
          nickname: nickname,
        },
      });

      if (!user) {
        throw new Error('존재하지 않는 사용자입니다.');
      }
      if (user.usertype !== requiredType) {
        throw new Error(
          `${
            requiredType === 'OWNER' ? '사장님' : '소비자'
          }만 사용할 수 있는 API입니다.`
        );
      }
      req.user = user;
      next();
    } catch (error) {
      // 토큰이 만료되었거나, 조작되었을 때, 에러 메시지를 다르게 출력합니다.
      switch (error.name) {
        case 'TokenExpiredError':
          return res.status(401).json({ message: '토큰이 만료되었습니다.' });
        case 'JsonWebTokenError':
          return res.status(401).json({ message: '토큰이 조작되었습니다.' });
        default:
          return res
            .status(401)
            .json({ message: error.message ?? '비정상적인 요청입니다.' });
      }
    }
  };
};

export const ownerauth = userauthmiddle('OWNER');
export const customerauth = userauthmiddle('CUSTOMER');
