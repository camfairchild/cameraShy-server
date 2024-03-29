import mongoose, { Schema, Document } from "mongoose";

export interface ICoords {
  lat: number,
  long: number
}

export interface IUser extends Document {
  appleId: string,
  googleId: string,
  osId: string,
  socketId: string,
  personId: string,
  name: string,
  lastCoords: ICoords,
  imageUrl: string
}

const UserSchema: Schema = new Schema({
  appleId: String,
  googleId: String,
  osId: String,
  socketId: String,
  personId: String,
  name: String,
  lastCoords: {
    lat: Number,
    long: Number,
  },
  imageUrl: String
});

export default mongoose.model<IUser>("User", UserSchema);