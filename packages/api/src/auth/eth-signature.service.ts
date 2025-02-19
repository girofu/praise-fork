import { Injectable, Scope, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { LoginResponseDto } from './dto/login-response.dto';
import { ApiException } from '../shared/exceptions/api-exception';
import { errorMessages } from '../shared/exceptions/error-messages';
import { HOSTNAME_TEST } from '../constants/constants.provider';
import { ethers } from 'ethers';
import { User, UserSchema } from '../users/schemas/users.schema';
import { Model } from 'mongoose';
import { DbService } from '../database/services/db.service';

@Injectable({ scope: Scope.REQUEST })
/**
 * Authenticate users using their Ethereum signature.
 */
export class EthSignatureService {
  private userModel: Model<User>;

  constructor(
    private readonly jwtService: JwtService,
    private dbService: DbService,
  ) {
    this.userModel = this.dbService.getPaginateModel<User>(
      User.name,
      UserSchema,
    );
  }

  /**
   * Generates a login message that will be signed by the frontend user, and validated by the API.
   *
   * @param account Ethereum address of the user
   * @param nonce Random nonce used for authentication
   * @returns string Login message
   */
  generateLoginMessage(account: string, nonce: string): string {
    return (
      'SIGN THIS MESSAGE TO LOGIN TO PRAISE.\n\n' +
      `ADDRESS:\n${account}\n\n` +
      `NONCE:\n${nonce}`
    );
  }

  /**
   * Logs in the user and returns a JWT token.
   *
   * @returns LoginResponse
   */
  async login(
    identityEthAddress: string,
    signature: string,
    hostname: string,
  ): Promise<LoginResponseDto> {
    let user: User;
    try {
      user = await this.userModel.findOne({ identityEthAddress }).lean();
    } catch (e) {
      // Throw UnauthorizedException instead of BadRequestException since
      // the user is not authenticated yet Nest.js defaults to that on
      // other authentication strategt errors
      throw new ApiException(errorMessages.UNAUTHORIZED);
    }

    // Check if user has previously generated a nonce
    if (!user.nonce) {
      throw new ApiException(errorMessages.NONCE_NOT_FOUND);
    }

    // Generate expected message
    const message = this.generateLoginMessage(identityEthAddress, user.nonce);

    // Verify signature
    try {
      // Recovered signer address must match identityEthAddress
      const signerAddress = ethers.utils.verifyMessage(message, signature);
      if (signerAddress !== identityEthAddress) throw new Error();
    } catch (e) {
      throw new UnauthorizedException('Signature verification failed');
    }

    const { roles } = user;

    // Create payload for the JWT token
    const payload: JwtPayload = {
      userId: user._id.toString(),
      identityEthAddress,
      roles,
      hostname: process.env.NODE_ENV === 'testing' ? HOSTNAME_TEST : hostname,
    } as JwtPayload;

    // Sign payload to create access token
    const accessToken = this.jwtService.sign(
      {
        ...payload,
        type: 'access',
      },
      {
        expiresIn: '7d',
        secret: process.env.JWT_SECRET,
      },
    );

    // Sign payload to create refresh token
    const refreshToken = this.jwtService.sign(
      {
        ...payload,
        type: 'refresh',
      },
      {
        expiresIn: '30d',
        secret: process.env.JWT_SECRET,
      },
    );

    // Return login response with access token
    return {
      user,
      accessToken,
      identityEthAddress,
      refreshToken,
      tokenType: 'Bearer',
    };
  }

  /**
   * Generate new tokens with existing refreshToken.
   *
   * @param token String
   * @param hostname String
   * @returns LoginResponse
   */
  async generateTokensByRefreshToken(
    token: string,
    hostname: string,
  ): Promise<LoginResponseDto> {
    let tokenPayload: JwtPayload;
    try {
      tokenPayload = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET,
      }) as JwtPayload;
    } catch (e) {
      if (e.name === 'TokenExpiredError') {
        throw new ApiException(errorMessages.JWT_TOKEN_EXPIRED);
      } else {
        throw new ApiException(errorMessages.UNAUTHORIZED);
      }
    }

    const user = await this.userModel
      .findOne({ identityEthAddress: tokenPayload.identityEthAddress })
      .lean();
    if (!user) {
      throw new ApiException(errorMessages.UNAUTHORIZED);
    }

    const expectedHostname =
      process.env.NODE_ENV === 'testing' ? HOSTNAME_TEST : hostname;

    if (
      expectedHostname !== tokenPayload.hostname ||
      tokenPayload.type !== 'refresh'
    ) {
      throw new ApiException(errorMessages.UNAUTHORIZED);
    }
    const payload = {
      identityEthAddress: tokenPayload.identityEthAddress,
      hostname: tokenPayload.hostname,
      roles: tokenPayload.roles,
      userId: tokenPayload.userId,
    };

    // Sign payload to create access token
    const accessToken = this.jwtService.sign(
      {
        ...payload,
        type: 'access',
      },
      {
        expiresIn: '7d',
        secret: process.env.JWT_SECRET,
      },
    );

    // Sign payload to create refresh token
    const refreshToken = this.jwtService.sign(
      {
        ...payload,
        type: 'refresh',
      },
      {
        expiresIn: '30d',
        secret: process.env.JWT_SECRET,
      },
    );

    // Return login response with access token
    return {
      user,
      accessToken,
      identityEthAddress: payload.identityEthAddress,
      refreshToken,
      tokenType: 'Bearer',
    };
  }
}
