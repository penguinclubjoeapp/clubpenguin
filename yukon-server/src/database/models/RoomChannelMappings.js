import BaseModel from '../BaseModel'


export default class RoomChannelMappings extends BaseModel {

    static init(sequelize, DataTypes) {
        return super.init(
            {
                roomId: {
                    type: DataTypes.INTEGER(11),
                    allowNull: false,
                    primaryKey: true
                },
                channelId: {
                    type: DataTypes.BIGINT(20),
                    allowNull: false
                },
                mappedAt: {
                    type: DataTypes.DATE,
                    allowNull: false,
                    defaultValue: DataTypes.NOW
                }
            },
            { sequelize, timestamps: false, tableName: 'room_channel_mappings' }
        )
    }

}
