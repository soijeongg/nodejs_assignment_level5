import express from 'express';
import Joi from 'joi';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../utils/prisma/index.js';
const router = express.Router();

//회원 가입시 사용할 스키마
const nicknameSchema = Joi.string().alphanum().min(3).max(15).required();
const passwordSchema = Joi.string().min(8).max(20).required();
const usertypeSchemma = Joi.string().valid('CUSTOMER', 'OWNER').required();

//sign-up router 작성
router.post('/sign-up', async (req, res, next) => {
  try {
    let { nickname, password, usertype } = req.body;
    const vaildation = nicknameSchema.validate(nickname);
    if (vaildation.error) {
      const error = new Error('닉네임 형식이 일치하지 않습니다');
      error.status = 400;
      throw error;
    }
    const passwordvali = passwordSchema.validate(password);
    if (passwordvali.error) {
      const error = new Error('비밀번호 형식이 일치하지 않습니다');
      error.status = 400;
      throw error;
    }
    if (usertype) {
      const usertypevali = usertypeSchemma.validate(usertype);
      if (usertypevali.error) {
        const error = new Error(
          "'user type에는 OWNER 와 CUSTOMER만 존재합니다 이 두개중 골라 쓰시거나 쓰지않고 넘어가주세요'"
        );
        error.status = 400;
        throw error;
      }
    }
    let findname = await prisma.users.findFirst({
      where: {
        nickname: nickname,
      },
    });
    if (findname) {
      const error = new Error('중복된 닉네임 입니다.');
      error.status = 409;
      throw error;
    }
    let hashpassword = await bcrypt.hash(password, 10);

    if (!usertype) {
      await prisma.users.create({
        data: {
          nickname,
          password: hashpassword,
        },
      });
    } else {
      await prisma.users.create({
        data: {
          nickname,
          password: hashpassword,
          usertype,
        },
      });
    }
    return res.status(200).json({ message: '회원가입이 완료되었습니다.' });
  } catch (error) {
    next(error);
  }
});

//sign-in router 작성
router.post('/sign-in', async (req, res, next) => {
  try {
    const { nickname, password } = req.body;
    const vaildation = nicknameSchema.validate(nickname);
    if (vaildation.error) {
      const error = new Error('닉네임 형식이 일치하지 않습니다');
      error.status = 400;
      throw error;
    }
    const passwordvali = passwordSchema.validate(password);
    if (passwordvali.error) {
      const error = new Error('비밀번호 형식이 일치하지 않습니다');
      error.status = 400;
      throw error;
    }
    const user = await prisma.users.findFirst({
      where: {
        nickname: nickname,
      },
    });
    if (!user) {
      const error = new Error('존재하지 않는 닉네임 입니다.');
      error.status = 401;
      throw error;
    }
    if (!(await bcrypt.compare(password, user.password))) {
      const error = new Error('비밀번호가 일치하지 않습니다.');
      error.status = 401;
      throw error;
    }
    const token = jwt.sign(
      {
        nickname: user.nickname,
      },
      process.env.JWT_SECRET,
      { expiresIn: '60m' } // 토큰의 유효기간을 60분으로 설정
    );

    res.cookie('authorization', `Bearer ${token}`);
    return res.status(200).json({ message: '로그인에 성공하였습니다.' });
  } catch (error) {
    next(error);
  }
});
export default router;
