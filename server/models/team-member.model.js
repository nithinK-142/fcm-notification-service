const mongoose = require("mongoose");

const teamMemberSchema = new mongoose.Schema(
    {
        email: { type: String, required: true, },
        name: { type: String, },
        password: { type: String, },
        department: { type: String, required: true, },
        user_hierarachy: { type: String, },
        profile: { type: String, },
    },
    {
        collection: "teammembers",
        strict: false,
    }
);

module.exports = {
    TeamMemberModel: function (conn) {
        return conn.models.TeamMember || conn.model("TeamMember", teamMemberSchema, "teammembers");
    }
};