import BaseModel from '../BaseModel'


export default class DiscordLinks extends BaseModel {

    static init(sequelize, DataTypes) {
        return super.init(
            {
                userId: {
                    type: DataTypes.INTEGER(11),
                    allowNull: false,
                    primaryKey: true
                },
                discordId: {
                    type: DataTypes.BIGINT(20),
                    allowNull: false,
                    unique: true
                },
                linkedAt: {
                    type: DataTypes.DATE,
                    allowNull: false,
                    defaultValue: DataTypes.NOW
                }
            },
            { sequelize, timestamps: false, tableName: 'discord_links' }
        )
    }

    static associate({ users }) {
        this.belongsTo(users, {
            foreignKey: 'userId'
        })
    }

}
